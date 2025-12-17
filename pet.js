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
        
        this.init();
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
        
        // 使用 emoji 羊作为宠物
        this.element.innerHTML = '🐑';
        this.element.style.fontSize = '48px';
        this.element.style.lineHeight = '48px';
        
        document.body.appendChild(this.element);
        
        // 创建对话框元素
        this.dialogElement = document.createElement('div');
        this.dialogElement.id = 'pet-dialog';
        this.dialogElement.style.cssText = `
            position: fixed;
            background: #ffffcc;
            border: 2px solid #333;
            border-radius: 12px;
            padding: 12px 16px;
            font-family: "Microsoft YaHei", "MS Sans Serif", Arial, sans-serif;
            font-size: 13px;
            line-height: 1.5;
            max-width: 280px;
            display: none;
            z-index: 10000;
            box-shadow: 3px 3px 8px rgba(0,0,0,0.25);
            animation: fadeIn 0.3s ease;
        `;
        this.dialogElement.innerHTML = `
            <div id="pet-dialog-text" style="color: #333;"></div>
            <div style="position: absolute; bottom: -12px; left: 30px; width: 0; height: 0; border-left: 12px solid transparent; border-right: 12px solid transparent; border-top: 12px solid #333;"></div>
            <div style="position: absolute; bottom: -9px; left: 31px; width: 0; height: 0; border-left: 11px solid transparent; border-right: 11px solid transparent; border-top: 11px solid #ffffcc;"></div>
        `;
        
        // 添加淡入动画
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
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
    }

    setPosition(x, y) {
        this.x = Math.max(0, Math.min(window.innerWidth - 32, x));
        this.y = Math.max(0, Math.min(window.innerHeight - 32, y));
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
        
        // 对话框显示在宠物上方
        let dialogX = this.x - dialogWidth / 2 + 16;
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
        dialogText.textContent = text;
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
        // 初始对话序列 - 不要太明显的暗示
        const initialDialogs = [
            { text: "咩~ 欢迎来到我的主人的网站！", delay: 3000, id: 'welcome' },
            { text: "这里看起来很简单... 对吧？", delay: 12000, id: 'intro1' },
            { text: "试试那些图标吧，都能用的~", delay: 25000, id: 'intro2' },
            { text: "我主人说，真正重要的东西往往藏在表面之下。", delay: 45000, id: 'hint1' },
            { text: "就像冰山... 你只能看到露出水面的那一小部分。", delay: 70000, id: 'hint2' }
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
            "咩？",
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
        }
        
        const randomDialog = dialogs[Math.floor(Math.random() * dialogs.length)];
        this.showDialog(randomDialog, 3000);
    }

    onMinesweeperWin() {
        if (!this.minesweeperCleared) {
            this.minesweeperCleared = true;
            
            // 庆祝动画（让宠物跳跃）
            this.celebrate();
            
            // 显示提示对话序列 - 暗示性的，不直接给答案
            setTimeout(() => {
                this.showDialog("哇！你真厉害！扫雷都通关了！", 4000);
            }, 1000);
            
            setTimeout(() => {
                this.showDialog("看来你确实有耐心... 也有足够的好奇心。", 4000);
            }, 6000);
            
            setTimeout(() => {
                this.showDialog("那我就告诉你一个秘密吧~", 4000);
            }, 11000);
            
            setTimeout(() => {
                this.showDialog("我主人说... 高手都用键盘，菜鸟才点鼠标。", 5000);
            }, 16000);
            
            setTimeout(() => {
                this.showDialog("有些东西，不是点出来的。", 5000);
            }, 22000);
            
            setTimeout(() => {
                this.showDialog("试试看... 同时按下几个你平时不会一起按的键？", 6000);
            }, 28000);
            
            setTimeout(() => {
                this.showDialog("Ctrl、Alt... 再加上一个字母... 说不定能打开什么呢？", 7000);
            }, 35000);
        }
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
}

// 初始化桌面宠物
let desktopPet;
window.addEventListener('load', () => {
    desktopPet = new DesktopPet();
});
