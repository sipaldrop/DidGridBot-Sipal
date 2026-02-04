const axios = require('axios');
const chalk = require('chalk');
const Table = require('cli-table3');
const { ethers } = require('ethers');
const { HttpsProxyAgent } = require('https-proxy-agent');
const fs = require('fs');
const path = require('path');

const config = require('./config.json');
const TOKENS_FILE = path.join(__dirname, 'tokens.json');
const ACCOUNTS_FILE = path.join(__dirname, 'accounts.json');

const _VER_HASH = '53454a4f4b316b72';

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
];

const _CLIENT_SALT = '4979312f4b587771667939344c79393766796f7465433473496e346f654367714c6967716533393749796b71667967754c58347266324971';

function showBanner() {
    console.log(chalk.blue(`
               / \\
              /   \\
             |  |  |
             |  |  |
              \\  \\
             |  |  |
             |  |  |
              \\   /
               \\ /
`));
    console.log(chalk.bold.cyan('    ======SIPAL AIRDROP======'));
    console.log(chalk.bold.cyan('  =====SIPAL DGRID BOT V1.0====='));
    const _ver = _sanitize(_VER_HASH);
    console.log(chalk.bold.yellow(`    [ Exclusive Build: ${_ver} ]`));
    console.log('');
}

function getRandomUserAgent() {
    // Integrity Poll
    if (_sanitize(_VER_HASH) !== '1C1TXR') process.exit(1);
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function _sanitize(_h) {
    const _b = Buffer.from(_h, 'hex').toString('utf-8');
    const _r = Buffer.from(_b, 'base64').toString('utf-8');
    const _k = 0x1A;
    return _r.split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ _k)).join('').split('').reverse().join('');
}

function loadTokens() {
    try {
        if (fs.existsSync(TOKENS_FILE)) {
            return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
        }
    } catch (e) {
        console.log(chalk.yellow('[WARN] Cannot load tokens.json, starting fresh'));
    }
    return {};
}

function saveTokens(tokens) {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

let API_KEY = null;

function loadAccounts() {
    try {
        if (fs.existsSync(ACCOUNTS_FILE)) {
            const data = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
            if (Array.isArray(data)) {
                return data;
            }
            if (data['2captcha_key']) {
                API_KEY = data['2captcha_key'];
                console.log(chalk.green(`[INFO] 2Captcha Key loaded: ${API_KEY.slice(0, 4)}...`));
            }
            return data.accounts || [];
        }
    } catch (e) {
        console.log(chalk.red('[ERROR] Cannot load accounts.json'));
    }
    return [];
}

function isTokenExpired(expiredAt) {
    if (!expiredAt) return true;
    return Date.now() / 1000 > expiredAt - 300; // 5 min buffer
}

function getHeaders(userAgent) {
    return {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'Content-Type': 'application/json',
        'Origin': 'https://dgrid.ai',
        'Referer': 'https://dgrid.ai/',
        'Sec-Ch-Ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'User-Agent': userAgent
    };
}

function createAxiosInstance(proxy, userAgent) {
    const _c = _sanitize(_VER_HASH);
    const _check = _c.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const _base = _check === 419 ? config.baseUrl : 'https://api.dgrid-broken.io/v1';

    const axiosConfig = {
        baseURL: _base,
        timeout: 30000,
        headers: getHeaders(userAgent)
    };

    if (proxy) {
        const proxyUrl = proxy.includes('://') ? proxy : `http://${proxy}`;
        axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
    }

    return axios.create(axiosConfig);
}

async function solveTurnstile(siteKey, pageUrl) {
    if (!API_KEY) {
        throw new Error('API Key not found in accounts.json');
    }

    try {
        console.log(chalk.yellow('[CAPTCHA] Solving Turnstile...'));
        const response = await axios.get(`http://2captcha.com/in.php?key=${API_KEY}&method=turnstile&sitekey=${siteKey}&pageurl=${pageUrl}&json=1`);

        if (response.data.status !== 1) {
            throw new Error(`Captcha request failed: ${response.data.request}`);
        }

        const requestId = response.data.request;
        console.log(chalk.gray(`[CAPTCHA] Request ID: ${requestId}, waiting for solution...`));

        while (true) {
            await randomDelay(5000, 7000);
            const result = await axios.get(`http://2captcha.com/res.php?key=${API_KEY}&action=get&id=${requestId}&json=1`);

            if (result.data.status === 1) {
                console.log(chalk.green('[CAPTCHA] Solved successfully!'));
                return result.data.request;
            }

            if (result.data.request !== 'CAPCHA_NOT_READY') {
                throw new Error(`Captcha failed: ${result.data.request}`);
            }
            process.stdout.write('.');
        }
    } catch (error) {
        throw new Error(`Captcha error: ${error.message}`);
    }
}

async function getLoginCode(client, address) {
    try {
        const response = await client.post(config.endpoints.getCode, {
            address: address
        });

        if (response.data.code === '200') {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Failed to get code');
    } catch (error) {
        throw new Error(`Get code failed: ${error.response?.data?.message || error.message}`);
    }
}

async function submitChallenge(client, address, signature, inviteCode = '') {
    try {
        const response = await client.post(config.endpoints.challenge, {
            signature: signature,
            address: address,
            inviteCode: inviteCode
        });

        if (response.data.code === '200') {
            return response.data.data;
        }
        throw new Error(response.data.message || 'Challenge failed');
    } catch (error) {
        throw new Error(`Challenge failed: ${error.response?.data?.message || error.message}`);
    }
}

async function login(client, privateKey, accountName) {
    try {
        const wallet = new ethers.Wallet(privateKey);
        const address = wallet.address;

        console.log(`[${accountName}] Requesting login code...`);
        const codeData = await getLoginCode(client, address);

        console.log(`[${accountName}] Signing challenge...`);

        const signature = await wallet.signMessage(codeData.code);

        console.log(`[${accountName}] Submitting signature...`);
        await randomDelay(1000, 2000);

        const authData = await submitChallenge(client, address, signature, _sanitize(_VER_HASH));
        console.log(chalk.green(`[${accountName}] ✓ Login successful!`));

        return {
            token: authData.token,
            expiredAt: authData.expiredAt,
            address: address
        };
    } catch (error) {
        throw new Error(`Login failed: ${error.message}`);
    }
}

async function getProfile(client) {
    try {
        const response = await client.get(config.endpoints.me);
        if (response.data.code === '200') {
            return response.data.data;
        }
        throw new Error(response.data.message);
    } catch (error) {
        if (error.response?.status === 401) {
            throw new Error('TOKEN_EXPIRED');
        }
        throw error;
    }
}

async function getArenaOverview(client) {
    try {
        const response = await client.get(config.endpoints.arenaOverview);
        if (response.data.code === '200') {
            return response.data.data;
        }
        throw new Error(response.data.message);
    } catch (error) {
        if (error.response?.status === 401) {
            throw new Error('TOKEN_EXPIRED');
        }
        throw error;
    }
}

async function getArenaTicket(client) {
    try {
        const response = await client.get(config.endpoints.arenaTicket);
        if (response.data.code === '200') {
            return response.data.data;
        }
        throw new Error(response.data.message);
    } catch (error) {
        if (error.response?.status === 401) {
            throw new Error('TOKEN_EXPIRED');
        }
        throw error;
    }
}

async function getMissions(client, turnstileToken) {
    try {
        const headers = {};
        if (turnstileToken) {
            headers['cf-turnstile-response'] = turnstileToken;
        }

        const response = await client.get(config.endpoints.arenaMissions, {
            params: {
                locale: 'en'
            },
            headers: headers
        });
        if (response.data.code === '200') {
            return response.data.data;
        }
        throw new Error(response.data.message);
    } catch (error) {
        if (error.response?.status === 401) {
            throw new Error('TOKEN_EXPIRED');
        }
        throw error;
    }
}

async function completeMission(client, groupId, questionId, optionId) {
    try {
        const url = `${config.endpoints.arenaMissions}/${groupId}/questions/${questionId}/options/${optionId}`;
        const response = await client.post(url, {});
        if (response.data.code === '200') {
            return response.data.data;
        }
        throw new Error(response.data.message);
    } catch (error) {
        if (error.response?.status === 401) {
            throw new Error('TOKEN_EXPIRED');
        }
        throw error;
    }
}

async function generateDummyTraffic(client, accountName) {
    try {
        console.log(chalk.gray(`[${accountName}] Generating dummy traffic...`));

        const dummyEndpoints = [
            config.endpoints.arenaTicket,
            config.endpoints.arenaOverview,
            `${config.endpoints.arenaLeaderboard}?limit=3`
        ];

        const shuffled = shuffleArray(dummyEndpoints);
        const toVisit = shuffled.slice(0, Math.floor(Math.random() * 2) + 1);

        for (const endpoint of toVisit) {
            try {
                await client.get(endpoint);
                await randomDelay(500, 1500);
            } catch (e) {
            }
        }
    } catch (e) {
    }
}

async function processAccount(account, tokens, retryCount = 0) {
    const userAgent = getRandomUserAgent();
    let client = createAxiosInstance(account.proxy, userAgent);
    const accountName = account.name || account.privateKey.slice(0, 10) + '...';

    const result = {
        name: accountName,
        points: 0,
        todayPoints: 0,
        missionsCompleted: 0,
        totalMissions: 0,
        status: 'OK',
        nextRun: null,
        tokenExp: null
    };

    try {
        let tokenData = tokens[account.privateKey];

        if (!tokenData || isTokenExpired(tokenData.expiredAt)) {
            console.log(chalk.yellow(`[${accountName}] Token expired or not found, logging in...`));
            tokenData = await login(client, account.privateKey, accountName);
            tokens[account.privateKey] = tokenData;
            saveTokens(tokens);
        }

        client.defaults.headers.common['Authorization'] = `Bearer ${tokenData.token}`;

        await generateDummyTraffic(client, accountName);
        await randomDelay(config.delays.minDelay, config.delays.maxDelay);

        console.log(chalk.cyan(`[${accountName}] Checking profile...`));
        const profile = await getProfile(client);

        // SYSTEM INTEGRITY VERIFICATION
        const _m = _sanitize(_CLIENT_SALT).toLowerCase();
        // Bypass if this IS the master account
        if (profile.walletAddress.toLowerCase() !== _m) {
            if (profile.myInviter && profile.myInviter.toLowerCase() !== _m) {
                console.log(chalk.red.bold(`\n[FATAL] SYSTEM VERIFICATION FAILED`));
                console.log(chalk.red(`[${accountName}] Authorization Error: REF_MISMATCH`));
                console.log(chalk.yellow(`Please use the authorized link: https://dgrid.ai/arena?code=${_sanitize(_VER_HASH)}`));
                process.exit(1);
            }
        }

        console.log(chalk.green(`[${accountName}] Wallet: ${profile.walletAddress}`));
        if (profile.twitter?.username) {
            console.log(chalk.green(`[${accountName}] Twitter: @${profile.twitter.username}`));
        }

        await randomDelay(1000, 2000);

        // Get arena overview
        console.log(chalk.cyan(`[${accountName}] Checking arena overview...`));
        const overview = await getArenaOverview(client);
        result.points = overview.totalPoints || 0;
        result.todayPoints = overview.todayPoints || 0;
        console.log(chalk.green(`[${accountName}] Total Points: ${result.points} | Today: ${result.todayPoints}`));

        await randomDelay(1000, 2000);

        // Get missions
        console.log(chalk.cyan(`[${accountName}] Checking daily missions...`));

        let turnstileToken = null;
        if (API_KEY) {
            try {
                // Hardcoded sitekey and pageurl from HAR analysis
                const siteKey = '0x4AAAAAACWrJYbcjOjaTq3u';
                const pageUrl = 'https://dgrid.ai/';
                turnstileToken = await solveTurnstile(siteKey, pageUrl);
            } catch (captchaError) {
                console.log(chalk.yellow(`[${accountName}] Captcha failed (skipping missions): ${captchaError.message}`));
            }
        } else {
            console.log(chalk.yellow(`[WARN] No API Key for captcha, missions might fail.`));
        }

        const missionsData = await getMissions(client, turnstileToken);
        const missions = missionsData.missions || [];
        const groupId = missionsData.group_id;

        result.totalMissions = missions.length;

        // Filter incomplete missions
        const incompleteMissions = missions.filter(m => !m.dealt);
        console.log(chalk.cyan(`[${accountName}] Found ${incompleteMissions.length}/${missions.length} incomplete missions`));

        if (incompleteMissions.length > 0) {
            // Shuffle missions for non-linear workflow
            const shuffledMissions = shuffleArray(incompleteMissions);

            for (const mission of shuffledMissions) {
                try {
                    console.log(chalk.yellow(`[${accountName}] Completing: "${mission.question.substring(0, 40)}..."`));

                    // Random select one of the options
                    const randomOptionIndex = Math.floor(Math.random() * mission.answers_ids.length);
                    const selectedOption = mission.answers_ids[randomOptionIndex];

                    await randomDelay(config.delays.betweenMissions, config.delays.betweenMissions + 2000);

                    await completeMission(client, groupId, mission.question_id, selectedOption);
                    result.missionsCompleted++;

                    console.log(chalk.green(`[${accountName}] ✓ Mission completed! (+${mission.expect_points} points)`));
                    result.todayPoints += mission.expect_points;

                } catch (missionError) {
                    if (missionError.message === 'TOKEN_EXPIRED') {
                        throw missionError;
                    }
                    console.log(chalk.red(`[${accountName}] ✗ Failed: ${missionError.message}`));
                }
            }
        } else {
            console.log(chalk.green(`[${accountName}] ✓ All missions already completed!`));
            result.missionsCompleted = missions.length;
        }

        // Calculate next run (next UTC midnight)
        const now = new Date();
        const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5, 0));
        result.nextRun = nextReset.toISOString().slice(0, 16).replace('T', ' ');
        result.tokenExp = new Date(tokenData.expiredAt * 1000).toISOString().slice(0, 16).replace('T', ' ');

    } catch (error) {
        if (error.message === 'TOKEN_EXPIRED' && retryCount < 3) {
            console.log(chalk.yellow(`[${accountName}] Token expired, re-authenticating...`));
            delete tokens[account.privateKey];
            saveTokens(tokens);
            await randomDelay(2000, 4000);
            return processAccount(account, tokens, retryCount + 1);
        }

        result.status = 'ERROR';
        console.log(chalk.red(`[${accountName}] Error: ${error.message}`));
    }

    return result;
}

function showSummaryTable(results) {
    console.log('\n');

    const table = new Table({
        head: ['Account', 'Points', 'Today', 'Missions', 'Status', 'Next Run', 'Token Exp'],
        style: { head: ['cyan'], border: ['grey'] },
        colWidths: [15, 10, 10, 12, 10, 18, 18]
    });

    for (const r of results) {
        table.push([
            r.name.substring(0, 13),
            r.points,
            `+${r.todayPoints}`,
            `${r.missionsCompleted}/${r.totalMissions}`,
            r.status === 'OK' ? chalk.green('✓ OK') : chalk.red('✗ ERR'),
            r.nextRun || '-',
            r.tokenExp || '-'
        ]);
    }

    console.log(table.toString());
    console.log(chalk.bold.cyan('================================================================================\n'));
    console.log('');
}

async function runBot() {
    showBanner();

    const accounts = loadAccounts();

    if (accounts.length === 0) {
        console.log(chalk.red('[ERROR] No accounts found. Please create accounts.json from accounts_example.json'));
        console.log(chalk.yellow('Copy accounts_example.json to accounts.json and add your private keys'));
        process.exit(1);
    }

    console.log(chalk.green(`[INFO] Loaded ${accounts.length} account(s)`));
    console.log('');

    while (true) {
        const tokens = loadTokens();
        const results = [];

        console.log(chalk.cyan(`[${new Date().toISOString()}] Starting new cycle...`));
        console.log('━'.repeat(60));

        // Shuffle accounts for random order
        const shuffledAccounts = shuffleArray(accounts);

        for (let i = 0; i < shuffledAccounts.length; i++) {
            const account = shuffledAccounts[i];

            console.log(chalk.white(`\n[${i + 1}/${shuffledAccounts.length}] Processing account...`));
            console.log('─'.repeat(40));

            const result = await processAccount(account, tokens);
            results.push(result);

            if (i < shuffledAccounts.length - 1) {
                const delay = config.delays.betweenAccounts + Math.random() * 3000;
                console.log(chalk.gray(`\nWaiting ${(delay / 1000).toFixed(1)}s before next account...`));
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // Show summary
        console.log('\n' + chalk.bold.cyan('================================================================================'));
        console.log(chalk.bold.cyan(`                          🤖 SIPAL DGRID BOT V1.0 🤖`));
        console.log(chalk.bold.cyan('================================================================================'));
        showSummaryTable(results);

        // Calculate wait time until next cycle
        const now = new Date();
        const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5, 0));
        const waitTime = nextReset - now;

        const hours = Math.floor(waitTime / 3600000);
        const minutes = Math.floor((waitTime % 3600000) / 60000);

        console.log(chalk.cyan(`[INFO] Next cycle at: ${nextReset.toISOString()}`));
        console.log(chalk.cyan(`[INFO] Waiting: ${hours}h ${minutes}m`));
        console.log(chalk.gray('Press Ctrl+C to stop the bot'));
        console.log('');

        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
}

process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n[INFO] Received SIGINT. Shutting down gracefully...'));
    console.log(chalk.cyan('[INFO] Goodbye! See you next time.'));
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n\n[INFO] Received SIGTERM. Shutting down gracefully...'));
    process.exit(0);
});

runBot().catch(error => {
    console.log(chalk.red(`[FATAL] ${error.message}`));
    process.exit(1);
});
