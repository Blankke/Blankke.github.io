// 桌面宠物系统
class DesktopPet {
    constructor() {
        this.element = null;
        this.dialogElement = null;
        this.x = 100;
        this.y = 100;
        this.isDragging = false;
        this.dialogQueue = [];
        this.currentState = 'idle';
        this.minesweeperCleared = false;
        this.dialogShown = {};
        this.radioHintGiven = false; // 是否已经给出广播暗示
        
        // 扫雷相关状态
        this.lastMinesweeperInteraction = Date.now();
        this.minesweeperIdleCheckInterval = null;
        
        this.init();
    }

    isTalkEnabled() {
        // Only use runtime flag, no persistence
        return typeof window.mewmewTalkEnabled === 'boolean' ? window.mewmewTalkEnabled : false;
    }

    init() {
        // 创建宠物元素
        this.element = document.createElement('div');
        this.element.id = 'desktop-pet';
        this.element.style.cssText = `
            position: fixed;
            width: 48px;
            height: 48px;
            cursor: grab;
            z-index: 9999;
            user-select: none;
            transition: left 0.3s ease, top 0.3s ease;
            filter: drop-shadow(2px 2px 3px rgba(0,0,0,0.3));
        `;
        
        // 使用粉色猫咪图片
        const img = document.createElement('img');
        img.src = 'icon/icon.png';
        img.style.width = '48px';
        img.style.height = '48px';
        img.style.display = 'block';
        img.style.imageRendering = 'pixelated'; // 保持像素风格
        this.element.appendChild(img);
        
        document.body.appendChild(this.element);
        
        // 创建对话框元素
        this.dialogElement = document.createElement('div');
        this.dialogElement.id = 'pet-dialog';
        this.dialogElement.style.cssText = `
            position: fixed;
            background: #ffffff;
            color: #000;
            border: 2px solid #000;
            padding: 8px 10px;
            font-family: "MS Sans Serif", Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            min-width: 100px;
            max-width: 280px;
            text-align: center;
            display: none;
            z-index: 10000;
            animation: petDialogFadeIn 0.12s ease;
        `;
        this.dialogElement.innerHTML = `
            <div id="pet-dialog-text" style="margin: 0;"></div>
            <div style="position: absolute; bottom: -10px; left: 50%; margin-left: -10px; width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-top: 10px solid #000;"></div>
            <div style="position: absolute; bottom: -8px; left: 50%; margin-left: -9px; width: 0; height: 0; border-left: 9px solid transparent; border-right: 9px solid transparent; border-top: 9px solid #fff;"></div>
        `;
        
        // 添加宠物悬停效果（轻微放大即可）
        const style = document.createElement('style');
        style.textContent = `
            @keyframes petDialogFadeIn {
                from { opacity: 0; transform: translateY(4px); }
                to { opacity: 1; transform: translateY(0); }
            }
            #desktop-pet:hover {
                transform: scale(1.1);
                transition: transform 0.2s ease;
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(this.dialogElement);
        
        // 设置初始位置
        this.setPosition(window.innerWidth - 150, window.innerHeight - 150);
        
        // 绑定事件
        this.bindEvents();
        
        // 开始对话流程
        this.startDialogSequence();
        
        // 随机移动
        this.startRandomMovement();

        // 启动扫雷闲置检查
        this.startMinesweeperIdleCheck();
    }

    setPosition(x, y) {
        this.x = Math.max(0, Math.min(window.innerWidth - 48, x));
        this.y = Math.max(0, Math.min(window.innerHeight - 48, y));
        this.element.style.left = this.x + 'px';
        this.element.style.top = this.y + 'px';
        
        // 更新对话框位置
        if (this.dialogElement.style.display === 'block') {
            this.updateDialogPosition();
        }
    }

    updateDialogPosition() {
        const dialogWidth = this.dialogElement.offsetWidth;
        const dialogHeight = this.dialogElement.offsetHeight;
        
        // 对话框显示在宠物上方，水平居中
        // 宠物宽度48px，中心点为 x + 24
        // 对话框中心点为 dialogX + dialogWidth / 2
        // 所以 dialogX = x + 24 - dialogWidth / 2
        let dialogX = this.x + 24 - dialogWidth / 2;
        let dialogY = this.y - dialogHeight - 20;
        
        // 确保对话框在屏幕内
        dialogX = Math.max(10, Math.min(window.innerWidth - dialogWidth - 10, dialogX));
        dialogY = Math.max(10, dialogY);
        
        this.dialogElement.style.left = dialogX + 'px';
        this.dialogElement.style.top = dialogY + 'px';
    }

    bindEvents() {
        // 拖拽功能
        this.element.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.element.style.cursor = 'grabbing';
            this.element.style.transition = 'none';
            
            const offsetX = e.clientX - this.x;
            const offsetY = e.clientY - this.y;
            
            const onMouseMove = (e) => {
                if (this.isDragging) {
                    this.setPosition(e.clientX - offsetX, e.clientY - offsetY);
                }
            };
            
            const onMouseUp = () => {
                this.isDragging = false;
                this.element.style.cursor = 'grab';
                this.element.style.transition = 'left 0.3s ease, top 0.3s ease';
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
        
        // 点击宠物显示对话
        this.element.addEventListener('click', (e) => {
            if (!this.isDragging) {
                this.showRandomDialog();
            }
        });
    }

    showDialog(text, duration = 5000) {
        const dialogText = document.getElementById('pet-dialog-text');
        const finalText = this.isTalkEnabled() ? text : '喵';
        dialogText.textContent = finalText;
        this.dialogElement.style.display = 'block';
        this.updateDialogPosition();
        
        // 自动隐藏
        setTimeout(() => {
            this.hideDialog();
        }, duration);
    }

    hideDialog() {
        this.dialogElement.style.display = 'none';
    }

    startDialogSequence() {
        // 初始对话序列 - 刚进入就开始说话吸引注意
        const initialDialogs = [
            { text: "我是这里的小向导，有什么需要帮助的吗？", delay: 6000, id: 'intro0' },
            { text: "这里看起来很简单... 对吧？", delay: 10000, id: 'intro1' },
            { text: "我主人说，真正重要的东西往往藏在表面之下。", delay: 30000, id: 'hint1' },
            { text: "就像冰山... 你只能看到露出水面的那一小部分。", delay: 40000, id: 'hint2' }
        ];
        
        initialDialogs.forEach(dialog => {
            setTimeout(() => {
                if (!this.dialogShown[dialog.id]) {
                    this.showDialog(dialog.text);
                    this.dialogShown[dialog.id] = true;
                }
            }, dialog.delay);
        });
    }

    startRandomMovement() {
        // 每隔一段时间随机移动
        setInterval(() => {
            if (!this.isDragging && Math.random() < 0.3) {
                const newX = Math.random() * (window.innerWidth - 100);
                const newY = Math.random() * (window.innerHeight - 100);
                this.setPosition(newX, newY);
            }
        }, 10000);
    }

    showRandomDialog() {
        const dialogs = [
            "喵？",
            "找我有什么事吗？",
            "我在这里呢~",
            "别总是戳我啦！",
            "有些秘密，需要你自己去发现..."
        ];
        
        if (this.minesweeperCleared) {
            dialogs.push("你已经通关扫雷了呢！");
            dialogs.push("有些东西，不是点出来的。");
            dialogs.push("你可以试试同时按下几个你平时不会一起按的键。");
            dialogs.push("键盘上的组合... 也许能打开什么？");
            dialogs.push("Ctrl、Alt... 再加上一个字母... 我主人姓什么来着？");
        }
        
        const randomDialog = dialogs[Math.floor(Math.random() * dialogs.length)];
        this.showDialog(randomDialog, 3000);
    }

    onMinesweeperWin(time) {
        // 移动到扫雷窗口旁边
        this.moveToElement('window-minesweeper');

        if (time > 50) {
            // 超过50秒
            this.showDialog(`通关啦！不过用了 ${time} 秒... 有点慢哦~`, 4000);
            setTimeout(() => {
                this.showDialog("下次试试能不能在 50 秒内完成？", 4000);
            }, 4500);
        } else {
            // 50秒内通关
            if (!this.minesweeperCleared) {
                this.minesweeperCleared = true;
                
                // 立即显示第一条对话
                this.showDialog(`哇！${time} 秒！太快了！`, 4000);
                
                // 庆祝动画（让宠物跳跃）
                this.celebrate();
                
                // 显示后续提示对话序列 - 暗示性的，不直接给答案
                setTimeout(() => {
                    this.showDialog("看来你确实有耐心... 也有足够的好奇心。", 4000);
                }, 5000);
                
                setTimeout(() => {
                    this.showDialog("那我就告诉你一个秘密吧~", 4000);
                }, 10000);
                
                setTimeout(() => {
                    this.showDialog("我主人说... 高手都用键盘，菜鸟才点鼠标。", 5000);
                }, 15000);
                
                setTimeout(() => {
                    this.showDialog("有些东西，不是点出来的。", 5000);
                }, 21000);
                
                setTimeout(() => {
                    this.showDialog("试试看... 同时按下几个你平时不会一起按的键？", 6000);
                }, 27000);
            } else {
                this.showDialog(`又是 ${time} 秒！保持这个速度！`, 3000);
                this.celebrate();
            }
        }
    }

    onMinesweeperLoss() {
        // 移动到扫雷窗口旁边
        this.moveToElement('window-minesweeper');
        
        const lossDialogs = [
            "哎呀，炸了...",
            "没关系，再试一次！",
            "小心一点哦~",
            "那个位置看起来就很危险...",
            "不要灰心，下次一定行！"
        ];
        const randomDialog = lossDialogs[Math.floor(Math.random() * lossDialogs.length)];
        this.showDialog(randomDialog, 3000);
    }

    resetMinesweeperIdleTimer() {
        this.lastMinesweeperInteraction = Date.now();
    }

    startMinesweeperIdleCheck() {
        // 每分钟检查一次
        this.minesweeperIdleCheckInterval = setInterval(() => {
            const now = Date.now();
            // 如果超过 5 分钟 (300000ms) 没有玩扫雷
            if (now - this.lastMinesweeperInteraction > 300000) {
                // 只有当没有其他对话显示时才显示
                if (this.dialogElement.style.display === 'none') {
                    this.showDialog("好久没玩扫雷了，手不痒吗？", 4000);
                    // 重置计时器，避免一直提醒
                    this.lastMinesweeperInteraction = Date.now(); 
                }
            }
        }, 60000);
    }

    moveToElement(elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;
        
        // 如果窗口是最小化的，就不移动过去
        if (!el.classList.contains('window-open') || el.classList.contains('window-minimized')) {
            return;
        }

        const rect = el.getBoundingClientRect();
        
        // 尝试放在右边
        let targetX = rect.right + 10;
        let targetY = rect.top + 50;
        
        // 如果右边放不下，放左边
        if (targetX + 60 > window.innerWidth) {
            targetX = rect.left - 60;
        }
        
        // 确保不超出屏幕
        targetX = Math.max(10, Math.min(window.innerWidth - 60, targetX));
        targetY = Math.max(10, Math.min(window.innerHeight - 60, targetY));
        
        this.setPosition(targetX, targetY);
    }

    celebrate() {
        // 简单的跳跃动画
        const originalY = this.y;
        let bounce = 0;
        const bounceInterval = setInterval(() => {
            bounce++;
            const offset = Math.sin(bounce * 0.5) * 20;
            this.setPosition(this.x, originalY - Math.abs(offset));
            
            if (bounce > 20) {
                clearInterval(bounceInterval);
                this.setPosition(this.x, originalY);
            }
        }, 50);
    }

    // 可以被外部调用来触发不同的对话
    triggerDialog(dialogId) {
        const dialogs = {
            'cmd_hint': "有时候，命令行比图形界面更强大...",
            'radio_hint': "我的主人喜欢听广播，特别是那个格拉斯哥的电台...",
            'secret_found': "你找到了！真不简单！"
        };
        
        if (dialogs[dialogId]) {
            this.showDialog(dialogs[dialogId], 5000);
        }
    }    
    // 给出广播暗示（被 CMD 调用）
    giveRadioHint() {
        if (this.radioHintGiven) return;
        this.radioHintGiven = true;
        
        // 含蓄的暗示序列
        setTimeout(() => {
            this.showDialog("你之前看过我主人的个人介绍吗？", 5000);
        }, 1000);
        
        setTimeout(() => {
            this.showDialog("他说过... 他喜欢听广播。", 5000);
        }, 7000);
        
        setTimeout(() => {
            this.showDialog("有些编号，不在文件里。", 6000);
        }, 13000);
        
        setTimeout(() => {
            this.showDialog("它们在... 你意想不到的地方。", 6000);
        }, 20000);
    }}

// 初始化桌面宠物
window.addEventListener('load', () => {
    window.desktopPet = new DesktopPet();
});
