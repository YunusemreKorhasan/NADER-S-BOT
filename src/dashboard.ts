import express, { Request, Response, NextFunction } from 'express';
import { getAllLogs, getLogsStats } from './services/activity-logger.js';
import { isBlacklisted, addToBlacklist, removeFromBlacklist, getBlacklist } from './services/blacklist.js';
import { getConfig, updateConfig } from './services/config-manager.js';
import { Client, TextChannel } from 'discord.js';
import session from 'express-session';

let botClient: Client | null = null;

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'admin123';

export function setBotClient(client: Client): void {
  botClient = client;
}

// Middleware to check authentication
const checkAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if ((req.session as any)?.authenticated) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
};

export function setupDashboard(app: express.Application): void {
  // Session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'cubecraft-bot-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
  }));

  // Login endpoint
  app.post('/api/login', express.json(), (req, res) => {
    const { password } = req.body;
    if (password === DASHBOARD_PASSWORD) {
      (req.session as any).authenticated = true;
      res.json({ success: true });
    } else {
      res.status(403).json({ error: 'Invalid password' });
    }
  });

  // Logout endpoint
  app.post('/api/logout', (req, res) => {
    (req.session as any).destroy(() => {
      res.json({ success: true });
    });
  });
  // API endpoint for blacklist - protected
  app.get('/api/blacklist', checkAuth, (req, res) => {
    const blacklist = getBlacklist();
    res.json({ blacklist });
  });

  app.post('/api/blacklist/add', checkAuth, express.json(), (req, res) => {
    const { userId, username, reason } = req.body;
    if (!userId || !username) return res.status(400).json({ error: 'Missing userId or username' });
    
    addToBlacklist(userId, username, reason);
    res.json({ success: true });
  });

  app.post('/api/blacklist/remove', checkAuth, express.json(), (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    
    const success = removeFromBlacklist(userId);
    res.json({ success });
  });


  // API endpoint for logs - protected
  app.get('/api/logs', checkAuth, (req, res) => {
    const logType = req.query.type as string || 'all';
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const logs = getAllLogs(logType === 'all' ? undefined : logType, limit);
    const stats = getLogsStats();
    res.json({ logs, stats });
  });

  // API endpoint for stats
  app.get('/api/stats', checkAuth, (req, res) => {
    if (!botClient) return res.status(503).json({ error: 'Bot not ready' });
    res.json({
      guilds: botClient.guilds.cache.size,
      users: botClient.users.cache.size,
      uptime: process.uptime(),
      status: botClient.user?.presence?.status || 'online',
      activity: botClient.user?.presence?.activities[0]?.name || 'None'
    });
  });

  // API to get all guilds
  app.get('/api/guilds', checkAuth, (req, res) => {
    if (!botClient) return res.status(503).json({ error: 'Bot not ready' });
    const guilds = botClient.guilds.cache.map(g => ({ id: g.id, name: g.name }));
    res.json({ guilds });
  });

  // API to get channels for a guild
  app.get('/api/channels/:guildId', checkAuth, async (req, res) => {
    if (!botClient) return res.status(503).json({ error: 'Bot not ready' });
    try {
      const guild = await botClient.guilds.fetch(req.params.guildId);
      const channels = guild.channels.cache
        .filter(c => c instanceof TextChannel)
        .map(c => ({ id: c.id, name: c.name }));
      res.json({ channels });
    } catch (e) {
      res.status(400).json({ error: 'Guild not found' });
    }
  });

  // API to send message
  app.post('/api/send-message', checkAuth, express.json(), async (req, res) => {
    const { channelId, message } = req.body;
    if (!botClient || !channelId || !message) return res.status(400).json({ error: 'Missing data' });
    try {
      const channel = await botClient.channels.fetch(channelId);
      if (channel instanceof TextChannel) {
        await channel.send(message);
        res.json({ success: true });
      } else {
        res.status(400).json({ error: 'Invalid channel' });
      }
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // API to change status - protected
  app.post('/api/set-status', checkAuth, express.json(), async (req, res) => {
    const { status, activity } = req.body;
    if (!botClient) return res.status(503).json({ error: 'Bot not ready' });
    try {
      if (status) await botClient.user?.setStatus(status as any);
      if (activity) await botClient.user?.setActivity(activity);
      
      // Save configuration for persistence
      updateConfig({ status, activity });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Root route for the Control Panel
  app.get('/', (req, res) => {
    // Check if user is authenticated
    if ((req.session as any).authenticated !== true) {
      return res.send(getLoginPage());
    }

    const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>Bot Control Panel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: sans-serif; background: #1a1a1a; color: white; padding: 20px; }
    .navbar { background: #0f0f0f; padding: 15px 20px; margin: -20px -20px 20px -20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #FF6B35; }
    .navbar h1 { color: #FF6B35; font-size: 1.5em; margin: 0; }
    .navbar-buttons { display: flex; gap: 10px; }
    .navbar-buttons button { background: #FF6B35; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; }
    .navbar-buttons button:hover { background: #e55a24; }
    .card { background: #2a2a2a; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #FF6B35; }
    h2 { color: #FF6B35; margin-top: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
    input, select, textarea { width: 100%; padding: 8px; margin: 5px 0; background: #333; color: white; border: 1px solid #555; border-radius: 4px; }
    button { background: #FF6B35; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer; width: 100%; }
    button:hover { background: #e55a24; }
    .log-entry { font-size: 0.8em; padding: 5px; border-bottom: 1px solid #333; }
    .time { color: #FF6B35; margin-left: 10px; }
  </style>
</head>
<body>
  <div class="navbar">
    <h1>وحدة تحكم البوت</h1>
    <div class="navbar-buttons">
      <button onclick="downloadBot()">⬇️ تحميل البوت</button>
      <button onclick="logout()">🚪 تسجيل الخروج</button>
    </div>
  </div>
  
  <div class="grid">
    <div class="card">
      <h2>الحالة العامة</h2>
      <div id="botStats">تحميل...</div>
    </div>
    
    <div class="card">
      <h2>تغيير الحالة</h2>
      <select id="statusSelect">
        <option value="online">Online</option>
        <option value="idle">Idle</option>
        <option value="dnd">Do Not Disturb</option>
        <option value="invisible">Invisible</option>
      </select>
      <input type="text" id="activityInput" placeholder="النشاط (مثلا: /help)">
      <button onclick="setStatus()">تحديث الحالة</button>
    </div>
  </div>

  <div class="card">
    <h2>إرسال رسالة للقنوات</h2>
    <label>اختر السيرفر:</label>
    <select id="messageGuildSelect" onchange="loadMessageChannels()" style="margin-bottom: 10px; width: 100%; padding: 8px; background: #333; color: white; border: 1px solid #555; border-radius: 4px;">
      <option value="">-- جاري التحميل --</option>
    </select>
    
    <label>اختر القناة:</label>
    <select id="messageChannelSelect" style="margin-bottom: 10px; width: 100%; padding: 8px; background: #333; color: white; border: 1px solid #555; border-radius: 4px;">
      <option value="">-- اختر السيرفر أولاً --</option>
    </select>
    
    <textarea id="messageText" placeholder="الرسالة..." style="margin-bottom: 10px; width: 100%; padding: 8px; background: #333; color: white; border: 1px solid #555; border-radius: 4px;"></textarea>
    <button onclick="sendMessage()" style="width: 100%;">إرسال الرسالة</button>
  </div>

  <div class="card">
    <h2>سجل النشاط (Logs)</h2>
    <div id="logs" style="max-height: 300px; overflow-y: auto;"></div>
  </div>

  <div class="card">
    <h2>قائمة المحظورين</h2>
    <div style="margin-bottom: 15px;">
      <input type="text" id="blockUserId" placeholder="ID المستخدم">
      <input type="text" id="blockUsername" placeholder="اسم المستخدم">
      <input type="text" id="blockReason" placeholder="السبب (اختياري)">
      <button onclick="addToBlacklist()">حظر المستخدم</button>
    </div>
    <div id="blacklistContainer" style="max-height: 200px; overflow-y: auto;"></div>
  </div>


  <script>
    function downloadBot() {
      window.location.href = '/api/download-bot';
    }

    async function logout() {
      await fetch('/api/logout', { method: 'POST' });
      window.location.reload();
    }

    async function updateStats() {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        document.getElementById('botStats').innerHTML = \`
          السيرفرات: \${data.guilds}<br>
          المستخدمين: \${data.users}<br>
          الحالة: \${data.status}<br>
          النشاط: \${data.activity}
        \`;
      } catch (e) {}
    }

    async function updateLogs() {
      try {
        const res = await fetch('/api/logs?limit=20');
        const data = await res.json();
        document.getElementById('logs').innerHTML = data.logs.map(l => \`
          <div class="log-entry">
            <span class="time">\${new Date(l.timestamp).toLocaleTimeString()}</span>
            [\${l.type}] \${l.username || ''} \${l.commandName || l.content || ''}
          </div>
        \`).join('');
      } catch (e) {}
    }

    async function setStatus() {
      await fetch('/api/set-status', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          status: document.getElementById('statusSelect').value,
          activity: document.getElementById('activityInput').value
        })
      });
      updateStats();
    }

    async function loadGuilds() {
      try {
        const res = await fetch('/api/guilds');
        const data = await res.json();
        const select = document.getElementById('messageGuildSelect');
        select.innerHTML = '';
        
        if (!data.guilds || data.guilds.length === 0) {
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = 'لا توجد سيرفرات';
          select.appendChild(opt);
          return;
        }
        
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '-- اختر السيرفر --';
        select.appendChild(defaultOpt);
        
        data.guilds.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g.id;
          opt.textContent = g.name;
          select.appendChild(opt);
        });
      } catch (e) { 
        console.error('Error loading guilds:', e);
      }
    }

    async function loadMessageChannels() {
      const guildId = document.getElementById('messageGuildSelect').value;
      const channelSelect = document.getElementById('messageChannelSelect');
      
      if (!guildId) {
        channelSelect.innerHTML = '<option value="">-- اختر السيرفر أولاً --</option>';
        return;
      }
      
      try {
        const res = await fetch('/api/channels/' + guildId);
        const data = await res.json();
        channelSelect.innerHTML = '';
        
        if (!data.channels || data.channels.length === 0) {
          const opt = document.createElement('option');
          opt.value = '';
          opt.textContent = 'لا توجد قنوات';
          channelSelect.appendChild(opt);
          return;
        }
        
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '-- اختر القناة --';
        channelSelect.appendChild(defaultOpt);
        
        data.channels.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = '#' + c.name;
          channelSelect.appendChild(opt);
        });
      } catch (e) { 
        console.error('Error loading channels:', e);
      }
    }

    async function sendMessage() {
      const channelId = document.getElementById('messageChannelSelect').value;
      const message = document.getElementById('messageText').value;
      if (!channelId) return alert('اختر القناة');
      if (!message) return alert('اكتب الرسالة');
      
      const res = await fetch('/api/send-message', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ channelId, message })
      });
      if (res.ok) {
        alert('✅ تم الإرسال');
        document.getElementById('messageText').value = '';
        document.getElementById('messageGuildSelect').value = '';
        document.getElementById('messageChannelSelect').value = '';
      } else alert('❌ خطأ في الإرسال');
    }

    async function updateBlacklist() {
      try {
        const res = await fetch('/api/blacklist');
        const data = await res.json();
        document.getElementById('blacklistContainer').innerHTML = data.blacklist.map(u => \`
          <div class="log-entry">
            <strong>\${u.username}</strong> (\${u.userId})<br>
            السبب: \${u.reason || 'لا يوجد'}<br>
            التاريخ: \${new Date(u.dateAdded).toLocaleDateString()}<br>
            <button onclick="removeFromBlacklist('\${u.userId}')" style="background: #ED4245; padding: 5px 10px; width: auto; margin-top: 5px;">رفع الحظر</button>
          </div>
        \`).join('');
      } catch (e) {}
    }

    async function addToBlacklist() {
      const userId = document.getElementById('blockUserId').value;
      const username = document.getElementById('blockUsername').value;
      const reason = document.getElementById('blockReason').value;
      
      if (!userId || !username) {
        alert('أدخل ID واسم المستخدم');
        return;
      }

      const res = await fetch('/api/blacklist/add', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ userId, username, reason })
      });
      
      if (res.ok) {
        alert('تم حظر المستخدم');
        document.getElementById('blockUserId').value = '';
        document.getElementById('blockUsername').value = '';
        document.getElementById('blockReason').value = '';
        updateBlacklist();
      } else alert('خطأ في الحظر');
    }

    async function removeFromBlacklist(userId) {
      if (!confirm('هل تريد رفع الحظر؟')) return;
      
      const res = await fetch('/api/blacklist/remove', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ userId })
      });
      
      if (res.ok) {
        alert('تم رفع الحظر');
        updateBlacklist();
      } else alert('خطأ في رفع الحظر');
    }

    // Auto-update every 5 seconds
    setInterval(() => { updateStats(); updateLogs(); updateBlacklist(); }, 5000);
    // Initial load
    updateStats(); updateLogs(); updateBlacklist(); loadGuilds();
    
    console.log('✅ Dashboard initialized');

    async function logout() {
      const res = await fetch('/api/logout', { method: 'POST' });
      if (res.ok) {
        window.location.href = '/';
      }
    }
  </script>
</body>
</html>`;
    res.send(html);
  });
}

function getLoginPage(): string {
  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CubeCraft Bot Control Panel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Arial', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .login-container {
      background: white;
      padding: 40px;
      border-radius: 10px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      width: 100%;
      max-width: 400px;
    }
    .login-container h1 {
      text-align: center;
      color: #333;
      margin-bottom: 30px;
      font-size: 24px;
    }
    .login-container input {
      width: 100%;
      padding: 12px;
      margin-bottom: 15px;
      border: 1px solid #ddd;
      border-radius: 5px;
      font-size: 14px;
    }
    .login-container button {
      width: 100%;
      padding: 12px;
      background: #FF6B35;
      color: white;
      border: none;
      border-radius: 5px;
      font-size: 16px;
      cursor: pointer;
      font-weight: bold;
    }
    .login-container button:hover {
      background: #e55a24;
    }
    .error { color: #ED4245; text-align: center; margin-top: 10px; font-size: 12px; }
    .success { color: #43B581; text-align: center; margin-top: 10px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="login-container">
    <h1>🤖 CubeCraft Bot Control</h1>
    <input type="password" id="password" placeholder="أدخل كلمة المرور" onkeypress="if(event.key==='Enter') login()">
    <button onclick="login()">دخول</button>
    <div id="message"></div>
  </div>

  <script>
    async function login() {
      const password = document.getElementById('password').value;
      if (!password) {
        showMessage('أدخل كلمة المرور', 'error');
        return;
      }

      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });

        if (res.ok) {
          showMessage('✅ تم التحقق بنجاح', 'success');
          setTimeout(() => window.location.reload(), 500);
        } else {
          showMessage('❌ كلمة المرور خاطئة', 'error');
        }
      } catch (error) {
        showMessage('❌ خطأ في الاتصال', 'error');
      }
    }

    function showMessage(msg, type) {
      const el = document.getElementById('message');
      el.textContent = msg;
      el.className = type;
    }
  </script>
</body>
</html>
  `;
}
