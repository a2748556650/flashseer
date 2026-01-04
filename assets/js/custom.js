document.addEventListener('DOMContentLoaded', function() {

    // ===================================================================
    // --- 【第一部分：基础UI逻辑 (保持不变)】 ---
    // ===================================================================

    const dailyTaskListContainer = document.getElementById('accordion-2');
    const clearLogButton = document.getElementById('clear-log-btn');
    const logContentArea = document.getElementById('log-content-area');
    const clearMyTasksButton = document.getElementById('clear-log-btn1');
    const clearPacketButton = document.getElementById('clear-log-btn3');
    const packetTextArea = document.getElementById('packetTextArea');

    if (clearLogButton && logContentArea) clearLogButton.addEventListener('click', () => { logContentArea.innerHTML = ''; });
    if (clearMyTasksButton && dailyTaskListContainer) clearMyTasksButton.addEventListener('click', () => { dailyTaskListContainer.innerHTML = ''; });
    if (clearPacketButton && packetTextArea) clearPacketButton.addEventListener('click', () => { packetTextArea.value = ''; });

    const selectAllBtn = document.getElementById('select-all-btn');
    const clearSelectionBtn = document.getElementById('clear-selection-btn');
    const addSelectedBtn = document.getElementById('add-selected-btn');
    const searchInput = document.getElementById('feature-search-input');
    const modeSwitch = document.getElementById('mode-switch');
    const flashAccordion = document.getElementById('accordion-flash');
    const unityAccordion = document.getElementById('accordion-unity');

    if (modeSwitch && flashAccordion && unityAccordion) {
        modeSwitch.addEventListener('change', function() {
            if (this.checked) {
                unityAccordion.classList.remove('d-none');
                flashAccordion.classList.add('d-none');
            } else {
                flashAccordion.classList.remove('d-none');
                unityAccordion.classList.add('d-none');
            }
        });
    }

    const getAllCheckboxes = () => document.querySelectorAll('.task-checkbox');

    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            getAllCheckboxes().forEach(cb => {
                if (cb.closest('.accordion-item').style.display !== 'none') cb.checked = true;
            });
        });
    }
    if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', () => getAllCheckboxes().forEach(cb => cb.checked = false));
    }
    if (addSelectedBtn && dailyTaskListContainer) {
        addSelectedBtn.addEventListener('click', () => {
            getAllCheckboxes().forEach(checkbox => {
                if (checkbox.checked) {
                    const original = checkbox.closest('.accordion-item');
                    if (original) {
                        const newItem = original.cloneNode(true);
                        const uid = 'task-' + Date.now() + Math.random().toString(36).substr(2, 5);
                        const collapse = newItem.querySelector('.accordion-collapse');
                        const btn = newItem.querySelector('.accordion-button');
                        if (collapse && btn) {
                            collapse.id = uid;
                            btn.setAttribute('data-bs-target', '#' + uid);
                            collapse.setAttribute('data-bs-parent', '#accordion-2');
                        }
                        const cb = newItem.querySelector('.task-checkbox');
                        if (cb) {
                            const delBtn = document.createElement('button');
                            delBtn.className = 'btn border-0 bg-transparent p-0 me-2 text-danger';
                            delBtn.innerHTML = '<i class="fas fa-minus-circle"></i>';
                            delBtn.onclick = (e) => { e.stopPropagation(); newItem.remove(); };
                            cb.replaceWith(delBtn);
                        }
                        dailyTaskListContainer.appendChild(newItem);
                    }
                }
            });
            getAllCheckboxes().forEach(cb => cb.checked = false);
        });
    }
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const term = this.value.toLowerCase().trim();
            document.querySelectorAll('.accordion-item').forEach(item => {
                const text = item.textContent.toLowerCase();
                item.style.display = text.includes(term) ? 'block' : 'none';
            });
        });
    }

    const hourSelect = document.getElementById('hour-select');
    const minuteSelect = document.getElementById('minute-select');
    if (hourSelect && minuteSelect) {
        for (let i = 0; i < 24; i++) hourSelect.add(new Option(i.toString().padStart(2, '0'), i));
        for (let i = 0; i < 60; i++) minuteSelect.add(new Option(i.toString().padStart(2, '0'), i));
    }

    // ===================================================================
    // --- 【第二部分：核心数据加载与联动逻辑】 ---
    // ===================================================================

    let clothOffsetMap = {};
    let currentEquippedIds = []; 
    let savedEquippedIds = [];   
    let isConfirmed = false;     

    // 联动映射表
    let suitToMaskMap = {}; // Key: 套装名, Value: 面具ID
    let maskToSuitMap = {}; // Key: 面具ID, Value: 套装名
    let suitPartsMap = {};  // Key: 套装名, Value: 包含的所有部件ID数组

    const URL_CONFIG_POS = "assets/js/config.json"; 
    const URL_TITLE      = "assets/js/achievements.json";
    const URL_SUIT_RAW   = "assets/js/SuitXMLInfo.js";   
    const URL_EQUIP_RAW  = "assets/js/ItemSeXMLInfo.js"; 

    console.log("正在加载资源...");

    // 读取带 export default 的 JS 文件
    async function loadRawModuleData(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            let text = await response.text();
            text = text.replace(/^\s*export\s+default\s+/, '').trim();
            if (text.endsWith(';')) text = text.slice(0, -1);
            return new Function('return ' + text)();
        } catch (e) {
            console.error("解析文件失败:", url, e);
            return null;
        }
    }

    Promise.all([
        fetch(URL_CONFIG_POS).then(r => r.ok ? r.json() : {}),
        fetch(URL_TITLE).then(r => r.ok ? r.json() : {}),
        loadRawModuleData(URL_SUIT_RAW),
        loadRawModuleData(URL_EQUIP_RAW)
    ])
    .then(([configPosData, titleData, suitRawData, equipRawData]) => {
        console.log("数据加载完成，开始处理关联...");

        // 1. 解析坐标
        if (configPosData && configPosData.clothpos) {
            configPosData.clothpos.forEach(item => {
                clothOffsetMap[String(item.id)] = { 
                    x: -(parseFloat(item.x) || 0) - 41, 
                    y: -(parseFloat(item.y) || 0) - 37 
                };
            });
        }

        // 临时存储所有面具的ID，用于快速查找
        const allMaskIds = new Set();

        // 2. 处理装备/面具数据 (ItemSeXMLInfo.js)
        const equipList = [];
        const rawEquips = equipRawData?.Equips?.Equip || [];

        rawEquips.forEach(item => {
            const part = String(item.Part); 
            // 筛选 Part="1"
            if (part === "1") {
                const name = item.Name;
                const itemId = String(item.ItemID);
                
                if (name && itemId) {
                    equipList.push({ name: name, ids: [itemId], id: itemId }); // 额外存一个单ID方便处理
                    allMaskIds.add(itemId);
                }
            }
        });

        // 3. 处理套装数据 (SuitXMLInfo.js) 并建立关联
        const suitList = [];
        const rawSuits = suitRawData?.root?.item || []; 
        
        rawSuits.forEach(item => {
            const name = item.name;
            const clothsStr = item.cloths;
            
            if (name && clothsStr) {
                const ids = String(clothsStr).trim().split(/\s+/);
                suitList.push({ name: name, ids: ids });
                
                // 存入套装部件表
                suitPartsMap[name] = ids;

                // ★★★ 核心关联逻辑 ★★★
                // 检查这个套装里的部件，有没有是面具的
                ids.forEach(partId => {
                    if (allMaskIds.has(partId)) {
                        // 找到了！建立双向映射
                        suitToMaskMap[name] = partId;
                        maskToSuitMap[partId] = name;
                    }
                });
            }
        });

        // 4. 渲染列表
        // 渲染套装列表 (#list-suit)
        populateList('list-suit', 'suit_group', suitList, 'suit');
        // 渲染面具列表 (#list-equip)
        populateList('list-equip', 'equip_group', equipList, 'equip');

        // 5. 解析称号
        const titleList = [];
        if (titleData && titleData.AchievementRules && titleData.AchievementRules.type) {
            titleData.AchievementRules.type.forEach(t => {
                if (t.Branches) {
                    t.Branches.forEach(bs => {
                        if (bs.Branch) {
                            bs.Branch.forEach(b => {
                                if (b.Rule) {
                                    b.Rule.forEach(r => {
                                        let tName = r.achName || r.title;
                                        if (tName) titleList.push({ name: tName, ids: [r.proicon] });
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
        populateList('list-title', 'title_group', titleList, 'title');

        initSuitSystem();
    })
    .catch(err => {
        console.error("系统初始化错误:", err);
    });

    // ===================================================================
    // --- 【辅助函数：生成列表与交互 (含联动逻辑)】 ---
    // ===================================================================

    // type: 'suit', 'equip', 'title'
    function populateList(containerId, groupName, items, type) {
        const listContainer = document.getElementById(containerId);
        if (!listContainer) return;
        listContainer.innerHTML = '';
        
        // ★★★ 1. 列表第一个必须是“无” ★★★
        createRadioItem(listContainer, groupName, '无', [], true, type, 'none');

        // 倒序显示
        const reversedItems = [...items].reverse();
        
        reversedItems.forEach(item => {
            if (item.name) {
                // 对于面具，我们把 item.id (单个ID) 传进去作为 key
                // 对于套装，我们把 item.name 传进去作为 key
                const key = type === 'equip' ? item.id : item.name;
                createRadioItem(listContainer, groupName, item.name, item.ids, false, type, key);
            }
        });
    }

    // key: 用于查找关联的键值 (SuitName 或 MaskItemID)
    function createRadioItem(container, groupName, labelText, partIds, isChecked, type, key) {
        const div = document.createElement('div');
        div.className = 'form-check';
        
        const input = document.createElement('input');
        input.type = 'radio';
        input.className = 'form-check-input';
        input.name = groupName;
        
        // 生成方便查找的 ID
        // 例如: suit-radio-苍星战甲, mask-radio-1300993, suit-radio-none
        // 注意：ID中不能有空格，简单处理一下
        const safeKey = key ? key.replace(/\s+/g, '_') : 'unknown';
        const domId = `${type}-radio-${safeKey}`;
        input.id = domId;
        
        // 存储真实数据，方便事件调用
        input.dataset.key = key;
        input.dataset.type = type; // suit or equip
        
        if (isChecked) input.checked = true;

        const label = document.createElement('label');
        label.className = 'form-check-label';
        label.htmlFor = domId;
        label.textContent = labelText;
        label.style.cursor = "pointer";

        // ★★★ 点击事件：联动逻辑 ★★★
        input.addEventListener('change', () => {
            if(input.checked) {
                // 1. 处理“无”的特殊情况
                if (key === 'none') {
                    currentEquippedIds = [];
                    // 如果选了“无”，对应的另一边也应该变成“无”吗？
                    // 通常为了逻辑闭环，可以把另一边也置为无
                    if (type === 'suit') checkRadio('equip-radio-none');
                    if (type === 'equip') checkRadio('suit-radio-none');
                } else {
                    // 2. 正常选择逻辑
                    // 如果是套装，使用套装的全部部件
                    // 如果是面具，且该面具有对应套装，也要使用套装的全部部件（根据需求“两个必须同时选择”）
                    let finalIds = [...partIds];

                    if (type === 'suit') {
                        // 选中了套装 -> 找面具
                        const linkedMaskId = suitToMaskMap[key];
                        if (linkedMaskId) {
                            // 选中对应的面具 Radio
                            checkRadio(`equip-radio-${linkedMaskId}`);
                        } else {
                            // 该套装没面具，把面具选为“无”
                            checkRadio('equip-radio-none');
                        }
                    } 
                    else if (type === 'equip') {
                        // 选中了面具 -> 找套装
                        const linkedSuitName = maskToSuitMap[key];
                        if (linkedSuitName) {
                            // 选中对应的套装 Radio
                            const safeSuitName = linkedSuitName.replace(/\s+/g, '_');
                            checkRadio(`suit-radio-${safeSuitName}`);
                            
                            // ★ 关键：因为要求“同时选择”，意味着要穿上整套套装
                            // 所以这里要把 currentEquippedIds 设为套装的 ID 列表
                            if (suitPartsMap[linkedSuitName]) {
                                finalIds = [...suitPartsMap[linkedSuitName]];
                            }
                        } else {
                            // 只是个独立面具，没套装
                            checkRadio('suit-radio-none');
                        }
                    }
                    
                    currentEquippedIds = finalIds;
                }
                
                // 3. 绘图
                renderPreview('suit-preview-container'); 
            }
        });

        div.appendChild(input);
        div.appendChild(label);
        container.appendChild(div);
    }

    // 辅助：安全地选中一个Radio
    function checkRadio(elementId) {
        const radio = document.getElementById(elementId);
        if (radio) {
            // 设置 checked = true 并不会触发 'change' 事件，
            // 所以不会导致死循环（Infinite Loop），这是安全的。
            radio.checked = true;
        }
    }

    // ===================================================================
    // --- 【第三部分：模态框与搜索逻辑】 ---
    // ===================================================================

    function initSuitSystem() {
        setupFilter('input-suit', 'list-suit');
        setupFilter('input-equip', 'list-equip');
        setupFilter('input-title', 'list-title');

        const suitModal = document.getElementById('suitSelectorModal');
        const loginModal = document.getElementById('loginModal');
        const confirmBtn = document.getElementById('btn-confirm-suit');

        if (suitModal) {
            suitModal.addEventListener('show.bs.modal', () => {
                savedEquippedIds = [...currentEquippedIds]; 
                isConfirmed = false;
                setTimeout(() => renderPreview('suit-preview-container'), 50);
            });

            suitModal.addEventListener('hidden.bs.modal', () => {
                if (isConfirmed) {
                    console.log("确认修改");
                } else {
                    console.log("取消修改，还原装备");
                    currentEquippedIds = [...savedEquippedIds]; 
                    // 这里可以加一个逻辑：还原 UI 上的选中状态，但这比较复杂，
                    // 暂时只还原数据，下次打开预览会根据数据重绘，但 Radio 状态可能不一致。
                    // 简单做法是这里不处理 Radio，因为用户已经取消了。
                }
                
                setTimeout(() => { renderPreview('suit-container'); }, 100);

                if (loginModal) {
                    const loginInstance = bootstrap.Modal.getOrCreateInstance(loginModal);
                    loginInstance.show();
                }
            });
        }

        if (confirmBtn) {
            const newBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
            newBtn.addEventListener('click', function() {
                isConfirmed = true; 
                const modalInstance = bootstrap.Modal.getInstance(suitModal);
                if(modalInstance) modalInstance.hide();
            });
        }

        if (loginModal) {
            loginModal.addEventListener('shown.bs.modal', () => {
                // 如果没有装备，尝试默认显示苍星战甲
                if (currentEquippedIds.length === 0 && suitPartsMap["苍星战甲"]) {
                    currentEquippedIds = [...suitPartsMap["苍星战甲"]];
                    // 也可以顺便把 Radio 选上，这里主要为了预览图
                }
                renderPreview('suit-container');
            });
        }
        
        setTimeout(() => renderPreview('suit-container'), 500);
    }

    function setupFilter(inputId, listId) {
        const input = document.getElementById(inputId);
        const list = document.getElementById(listId);
        if (!input || !list) return;

        input.addEventListener('input', function() {
            const filterText = this.value.toLowerCase().trim();
            const items = list.querySelectorAll('.form-check');
            items.forEach(item => {
                item.style.display = item.textContent.toLowerCase().includes(filterText) ? "" : "none";
            });
        });
    }

    // ===================================================================
    // --- 【第四部分：绘图核心】 ---
    // ===================================================================

    function renderPreview(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.style.display = "flex";
        container.style.alignItems = "center";
        container.style.justifyContent = "center";
        container.style.overflow = "hidden"; 

        let canvas = container.querySelector("canvas");
        if (!canvas) {
            canvas = document.createElement("canvas");
            canvas.width = 600; 
            canvas.height = 600;
            canvas.style.width = "100%"; 
            canvas.style.height = "100%";
            canvas.style.objectFit = "contain";
            container.appendChild(canvas);
        }

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!currentEquippedIds || currentEquippedIds.length === 0) return;

        const centerX = 300;
        const centerY = 300;
        const ZOOM_LEVEL = 1.0; 
        const baseUrl = "https://seerh5.61.com/resource/assets/item/cloth/prev/";

        let loadedCount = 0;
        const partsToDraw = [];

        currentEquippedIds.forEach(id => {
            const offset = clothOffsetMap[String(id)];
            
            const finalX = offset ? offset.x : 0;
            const finalY = offset ? offset.y : 0;

            const img = new Image();
            img.src = baseUrl + id + ".png";

            partsToDraw.push({ img: img, x: finalX, y: finalY, id: id });

            const checkDone = () => {
                loadedCount++;
                if (loadedCount === currentEquippedIds.length) {
                    drawAll(partsToDraw);
                }
            };

            img.onload = checkDone;
            img.onerror = () => {
                checkDone();
            };
        });

        function drawAll(parts) {
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.scale(ZOOM_LEVEL, ZOOM_LEVEL);
            
            parts.forEach(part => {
                if (part.img.complete && part.img.naturalWidth > 0) {
                    const drawX = part.x;
                    const drawY = part.y;
                    ctx.drawImage(part.img, drawX, drawY);
                }
            });
            ctx.restore();
        }
    }
});

function updateLoginStatus(userAccount, isLoggedIn) {
  const statusElement = document.getElementById('login-status-text');
  if (statusElement) {
    statusElement.textContent = isLoggedIn ? `米米号: ${userAccount} [登录]` : `米米号: [未登录]`;
  }
}