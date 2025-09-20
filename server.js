require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const simpleGit = require('simple-git');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(bodyParser.json({ limit: '50mb' })); // 大檔案支援

const PORT = process.env.PORT || 4000;
const API_KEY = process.env.SITE_B_API_KEY;
const REPO_PATH = path.resolve(process.env.REPO_PATH || './repo');
const GIT_REMOTE = process.env.GIT_REMOTE || 'origin';
const GIT_BRANCH = process.env.GIT_BRANCH || 'main';
const git = simpleGit(REPO_PATH);

// Middleware: 驗證 Site A 的 API Key
app.use((req, res, next) => {
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) return res.status(403).json({ error: 'Forbidden' });
  next();
});

// API: 接收部署檔案
app.post('/api/deploy', async (req, res) => {
  try {
    const { files } = req.body;
    if (!files || !Array.isArray(files)) {
      return res.status(400).json({ error: 'files 欄位必須是陣列' });
    }

    // 寫入 repo
    for (const f of files) {
      const fullPath = path.join(REPO_PATH, f.path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, f.content, 'utf8');
    }

    // Git commit & push
    await git.add('.');
    await git.commit(`AI auto-update: ${new Date().toISOString()}`);
    await git.push(GIT_REMOTE, GIT_BRANCH);

    res.json({ ok: true, message: '已成功部署到 GitHub' });
  } catch (err) {
    console.error('Deploy error:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: 簡單健康檢查
app.get('/api/status', (req, res) => res.json({ ok: true, time: new Date() }));

app.listen(PORT, () => {
  console.log(`🚀 Site B running at http://localhost:${PORT}`);
  console.log(`Repo path: ${REPO_PATH}, Branch: ${GIT_BRANCH}`);
});
