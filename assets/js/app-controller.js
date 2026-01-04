document.addEventListener('DOMContentLoaded', function() {
    // ==================== 状态变量 ====================
    let currentAccount = null;
    const loggedInAccounts = new Set(); 

    // ==================== 获取所有 DOM 元素 ====================
    const usernameInput = document.getElementById('usernameInput');
    const passwordInput = document.getElementById('passwordInput');
    const loginForm = document.getElementById('login-form');
    const loginButton = document.getElementById('generateIniBtn');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    const systemLogOutput = document.getElementById('log-content-area');
    const dropdownButton = document.getElementById('down1');
    const loginStatusText = document.getElementById('login-status-text');

    // ==================== 核心功能函数 ====================

    function updateLoginStatus(account, isLoggedIn, keepAccountInfo = false) {
        if (isLoggedIn) {
            currentAccount = account;
            loginStatusText.textContent = `米米号：${account}`; 
            usernameInput.value = account;
            passwordInput.value = '';
            passwordInput.disabled = true;
            passwordInput.placeholder = '已登录';
            loginButton.textContent = '断开连接';
            loginButton.classList.remove('btn-primary');
            loginButton.classList.add('btn-danger');
        } else {
            loginButton.textContent = '登录';
            loginButton.classList.remove('btn-danger');
            loginButton.classList.add('btn-primary');

            if (keepAccountInfo) {
                currentAccount = account;
                loginStatusText.textContent = `米米号：${account}`;
                usernameInput.value = account;
                passwordInput.value = '';
                passwordInput.disabled = true;
                passwordInput.placeholder = '✓ 使用已保存的密码';
            } else {
                currentAccount = null;
                loginStatusText.textContent = '米米号：未登录';
                usernameInput.value = '';
                passwordInput.value = '';
                passwordInput.disabled = false;
                passwordInput.placeholder = '密码';
            }
        }
    }
    
    async function loadSavedAccounts() {
        try {
            const response = await fetch('/get-accounts');
            if (!response.ok) throw new Error(`网络错误: ${response.statusText}`);
            
            const data = await response.json();
            dropdownMenu.innerHTML = ''; // 清空现有列表

            if (data.status === 'success' && Array.isArray(data.accounts)) {
                data.accounts.forEach(accountData => {
                    const li = document.createElement('li');
                    
                    // 使用 div 而不是 a 标签，避免 href 跳转干扰，且更容易控制布局
                    const itemContainer = document.createElement('div');
                    itemContainer.classList.add('dropdown-item', 'd-flex', 'justify-content-between', 'align-items-center');
                    itemContainer.style.cursor = 'pointer'; // 鼠标变手型
                    
                    // 1. 左侧：账号 (点击切换)
                    const accountSpan = document.createElement('span');
                    accountSpan.textContent = accountData.account;
                    accountSpan.style.pointerEvents = 'none'; // 让点击事件穿透到父容器，简化处理
                    
                    // 2. 右侧：删除按钮 (点击删除)
                    const deleteSpan = document.createElement('span');
                    deleteSpan.textContent = '删除';
                    deleteSpan.classList.add('text-danger', 'fw-bold'); // 红色、加粗
                    deleteSpan.style.fontSize = '12px';
                    deleteSpan.style.pointerEvents = 'auto'; // 恢复点击事件
                    deleteSpan.style.paddingLeft = '10px';
                    
                    // 【删除事件】
                    deleteSpan.onclick = async (e) => {
                        e.stopPropagation(); // 绝对阻止冒泡，防止触发选中账号
                        e.preventDefault();
                        
                        // 直接执行删除，无弹窗
                        await handleDeleteAccount(accountData.account);
                    };
                    
                    // 【选中账号事件】(点击整行)
                    itemContainer.onclick = (e) => {
                        e.preventDefault();
                        
                        usernameInput.value = accountData.account;
                        passwordInput.value = '';
                        passwordInput.disabled = true;
                        passwordInput.placeholder = '✓ 使用已保存的密码';
                        
                        if (loggedInAccounts.has(accountData.account)) {
                           updateLoginStatus(accountData.account, true);
                        } else {
                           loginButton.textContent = '登录';
                           loginButton.classList.remove('btn-danger');
                           loginButton.classList.add('btn-primary');
                           loginStatusText.textContent = `米米号：${accountData.account}`;
                        }
                        // 关闭下拉菜单
                        const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownButton);
                        if (dropdownInstance) dropdownInstance.hide();
                    };

                    itemContainer.appendChild(accountSpan);
                    itemContainer.appendChild(deleteSpan);
                    li.appendChild(itemContainer);
                    dropdownMenu.appendChild(li);
                });

                if (data.accounts.length > 0) {
                    const hr = document.createElement('hr');
                    hr.classList.add('dropdown-divider');
                    dropdownMenu.appendChild(hr);
                }
            }
            
            // 添加新账号选项
            const addNewLi = document.createElement('li');
            const addNewLink = document.createElement('a');
            addNewLink.classList.add('dropdown-item', 'text-primary');
            addNewLink.href = '#';
            addNewLink.textContent = '+ 添加新账号';
            addNewLink.onclick = (e) => {
                e.preventDefault();
                updateLoginStatus('', false, false);
                const dropdownInstance = bootstrap.Dropdown.getInstance(dropdownButton);
                if (dropdownInstance) dropdownInstance.hide();
            };
            addNewLi.appendChild(addNewLink);
            dropdownMenu.appendChild(addNewLi);

        } catch (error) {
            console.error('获取账号列表失败:', error);
        }
    }

    async function handleDeleteAccount(account) {
        try {
            const response = await fetch('/delete-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account: account }),
            });
            const result = await response.json();
            if (result.status === 'success') {
                addSystemLog(`账号 ${account} 存档已删除`);
                // 如果删除的是当前输入框里的账号，重置界面
                if (usernameInput.value === account) {
                    updateLoginStatus('', false, false);
                }
                // 立即刷新列表
                loadSavedAccounts(); 
            }
        } catch (error) {
            addSystemLog(`删除请求错误: ${error.message}`);
        }
    }
    
    function addSystemLog(message) {
        if (!systemLogOutput) return;
        const logEntry = document.createElement('p');
        const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        logEntry.textContent = `[${timestamp}] ${message}`;
        logEntry.style.margin = '0';
        logEntry.style.fontFamily = 'monospace';
        systemLogOutput.appendChild(logEntry);
        systemLogOutput.scrollTop = systemLogOutput.scrollHeight;
    }

    // ==================== 事件监听 ====================
    
    usernameInput.addEventListener('input', () => {
        const val = usernameInput.value.trim();
        loginStatusText.textContent = val ? `米米号：${val}` : '米米号：未登录';
        
        if (!loggedInAccounts.has(val)) {
            passwordInput.disabled = false;
            passwordInput.placeholder = '密码';
            loginButton.textContent = '登录';
            loginButton.classList.remove('btn-danger');
            loginButton.classList.add('btn-primary');
        }
    });
    
    async function handleDisconnect(account) {
        try {
            const response = await fetch('/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account: account }),
            });
            const result = await response.json();
            if (result.status !== 'success') {
                throw new Error(result.message);
            }
            addSystemLog(`账号 ${account} 已成功断开连接。`);
        } catch (error) {
            addSystemLog(`断开连接时发生错误: ${error.message}`);
        } finally {
            loggedInAccounts.delete(account);
            updateLoginStatus(account, false, true);
        }
    }
    
    async function handleLogin(account, password, isAutoLogin) {
        loginButton.disabled = true;
        loginButton.textContent = '处理中...';
        const endpoint = isAutoLogin ? '/login-from-file' : '/start-login';
        const payload = { account, password };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok || result.status !== 'success') throw new Error(result.message || '未知错误');
            loggedInAccounts.add(account);
            updateLoginStatus(account, true);
            addSystemLog(`账号 ${account} 已登录成功`);
            setTimeout(loadSavedAccounts, 500); 
        } catch (error) {
            addSystemLog(`登录失败: ${error.message}`);
            if(isAutoLogin) {
                 passwordInput.disabled = false;
                 passwordInput.placeholder = '密码';
                 alert('自动登录失败，请手动输入密码');
            }
        } finally {
            loginButton.disabled = false;
            if(loggedInAccounts.has(account)){
                 loginButton.textContent = '断开连接';
            } else {
                 loginButton.textContent = '登录';
            }
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const account = usernameInput.value.trim();
            if (!account) return;

            if (loginButton.textContent === '断开连接') {
                handleDisconnect(account);
            } else {
                const password = passwordInput.value.trim();
                const isAutoLogin = passwordInput.disabled;
                if (!isAutoLogin && !password) return;
                handleLogin(account, password, isAutoLogin);
            }
        });
    }

    dropdownButton.addEventListener('click', loadSavedAccounts);

    // ==================== 初始化 ====================
    updateLoginStatus('', false);
    loadSavedAccounts();
});