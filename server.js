require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const simpleGit = require('simple-git');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(bodyParser.json({ limit: '50mb' }));

const PORT = process.env.PORT || 4000;
const SITE_B_API_KEY = process.env.SITE_B_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIT_REPO = process.env.GIT_REPO; // username/repo
const GIT_BRANCH = process.env.GIT_BRANCH || 'main';
const REPO_PATH = '/tmp/repo'; // Render 可寫目錄

// Middleware: 驗證 Site A API Key
app.use((req, res, next) => {
  const key = req.headers['x-api-key'];
  if (key !== SITE_B_API_KEY) return res.status(403).json({ error: 'Forbidden' });
  next();
});

// 初始化 git repo
async function getGitInstance() {
  await fs.mkdir(REPO_PATH, { recursive: true });
  const git = simpleGit(REPO_PATH);

  try {
    await git.revparse(['--is-inside-work-tree']); // 檢查是否為 git repo
  } catch {
    console.log('📂 Repo 不存在，初始化 git...');
    await git.init();
    await git.addRemote('origin', `https://${GITHUB_TOKEN}@github.com/${GIT_REPO}.git`);
    await git.fetch('origin');
    try {
      await git.checkoutBranch(GIT_BRANCH, `origin/${GIT_BRANCH}`);
    } catch {
      // 如果分支不存在，直接建立
      await git.checkoutLocalBranch(GIT_BRANCH);
    }
  }

  return git;
}

// API: 健康檢查
app.get('/api/status', (req, res) => res.json({ ok: true, time: new Date() }));

// API: 接收部署檔案
app.post('/api/deploy', async (req, res) => {
  try {
    const { files } = req.body;
    if (!files || !Array.isArray(files)) return res.status(400).json({ error: 'files 必須是陣列' });

    const git = await getGitInstance();

    // 寫入檔案
    for (const f of files) {
      const fullPath = path.join(REPO_PATH, f.path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, f.content, 'utf8');
    }

    // Git commit & push
    await git.add('.');
    await git.commit(`AI auto-update: ${new Date().toISOString()}`);
    await git.push('origin', GIT_BRANCH);

    res.json({ ok: true, message: '✅ 已成功部署到 GitHub' });
  } catch (err) {
    console.error('Deploy error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Site B running at http://localhost:${PORT}`);
});
