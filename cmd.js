// 命令行系统
class TerminalSystem {
    constructor() {
        this.commandHistory = [];
        this.historyIndex = -1;
        this.currentPath = 'C:\\Users\\Blankke';
        this.unlocked = false; // 是否已经解锁（获得快捷键 token）
        this.radioTokenFound = false; // 是否找到收音机 token
        
        // Tab 补全状态
        this.tabState = {
            isActive: false,
            matches: [],
            index: 0,
            basePath: ''
        };

        // 预设的命令历史（看起来像真实使用过的）
        this.presetHistory = [
            'ver',
            'dir',
            'type resume.txt',
            'cd documents',
            'copy notes.raw ..\\diary.bin',
            'dir /w',
            'mem'
        ];
        
        // 文件系统模拟
        this.fileSystem = {
            'C:\\Users\\Blankke': {
                'RESUME.TXT': 'NAME: Blankke\nOCCUPATION: Developer\nHOBBIES: Programming, Gaming, Blogging\nLOCATION: I am in the INTERNET',
                'DIARY.BIN': null, // 特殊文件，需要解锁
                'DOCUMENTS': {}
            },
            'C:\\Users\\Blankke\\DOCUMENTS': {
                'NOTES.RAW': 'Personal thoughts and observations...\n[This file has been processed]'
            }
        };
        
        this.init();
    }
    
    init() {
        this.terminalOutput = document.getElementById('terminal-output');
        this.terminalInput = document.getElementById('terminal-input');
        this.terminalInputDisplay = document.getElementById('terminal-input-display');
        this.terminalPromptText = document.getElementById('terminal-prompt-text');
        this.terminalContainer = document.getElementById('terminal-container');
        
        if (!this.terminalInput) return;

        // 获取光标元素
        this.terminalCursor = this.terminalContainer.querySelector('.terminal-cursor');
        // 创建光标右侧文本显示元素
        if (this.terminalCursor) {
            this.terminalInputRight = document.createElement('span');
            this.terminalCursor.parentNode.insertBefore(this.terminalInputRight, this.terminalCursor.nextSibling);
        }
        
        // 聚焦输入框
        this.terminalContainer.addEventListener('click', () => {
            this.terminalInput.focus();
        });

        // 监听输入变化
        this.terminalInput.addEventListener('input', () => {
            this.updateInputDisplay();
        });

        // 监听光标移动 (按键、点击)
        this.terminalInput.addEventListener('keyup', () => this.updateInputDisplay());
        this.terminalInput.addEventListener('click', () => this.updateInputDisplay());
        this.terminalInput.addEventListener('select', () => this.updateInputDisplay());
        
        // 绑定按键事件
        this.terminalInput.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                this.handleTabCompletion();
                return;
            }

            // 重置 Tab 状态
            if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt') {
                this.tabState.isActive = false;
            }

            if (e.key === 'Enter') {
                this.executeCommand(this.terminalInput.value);
                this.terminalInput.value = '';
                this.updateInputDisplay();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateHistory(-1);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateHistory(1);
            }
        });
        
        // 显示欢迎信息
        this.printWelcome();
    }

    updateInputDisplay() {
        if (!this.terminalInputDisplay || !this.terminalInput) return;
        
        const value = this.terminalInput.value;
        const cursorPos = this.terminalInput.selectionStart;
        
        const left = value.slice(0, cursorPos);
        const right = value.slice(cursorPos);
        
        this.terminalInputDisplay.textContent = left;
        if (this.terminalInputRight) {
            this.terminalInputRight.textContent = right;
        }
    }
    
    printWelcome() {
        const welcome = `
Microsoft(R) Windows 98
   (C)Copyright Microsoft Corp 1981-1998.
`;
        this.print(welcome, 'system');
        this.print('Type "HELP" for a list of commands.', 'hint');
        this.printPrompt();
    }
    
    print(text, type = 'output') {
        const line = document.createElement('div');
        line.className = `terminal-line terminal-${type}`;
        line.textContent = text;
        this.terminalOutput.appendChild(line);
        this.scrollToBottom();
    }
    
    printPrompt() {
        // 更新输入行的提示符
        if (this.terminalPromptText) {
            this.terminalPromptText.innerHTML = `<span class="prompt-path">${this.currentPath}</span><span class="prompt-symbol">&gt;</span>`;
        }
        // 清空输入显示
        if (this.terminalInput) this.terminalInput.value = '';
        this.updateInputDisplay();
        this.scrollToBottom();
    }
    
    scrollToBottom() {
        // Scroll the container instead of the output div
        if (this.terminalContainer) {
            this.terminalContainer.scrollTop = this.terminalContainer.scrollHeight;
        }
    }
    
    executeCommand(input) {
        const trimmedInput = input.trim();
        
        // 将刚才的输入行（提示符+命令）添加到输出区域
        const commandLine = document.createElement('div');
        commandLine.className = 'terminal-line';
        commandLine.innerHTML = `<span class="terminal-prompt"><span class="prompt-path">${this.currentPath}</span><span class="prompt-symbol">&gt;</span></span><span class="terminal-input">${input}</span>`;
        this.terminalOutput.appendChild(commandLine);

        if (!trimmedInput) {
            this.printPrompt();
            return;
        }
        
        // 记录到历史
        this.commandHistory.push(trimmedInput);
        this.historyIndex = this.commandHistory.length;
        
        // 解析命令
        const parts = trimmedInput.split(/\s+/);
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);
        
        // 执行命令
        switch(command) {
            case 'help':
                this.cmdHelp();
                break;
            case 'cls':
            case 'clear': // 兼容
                this.cmdCls();
                break;
            case 'ver':
            case 'uname': // 兼容
                this.cmdVer();
                break;
            case 'dir':
            case 'ls': // 兼容
                this.cmdDir(args);
                break;
            case 'cd':
            case 'chdir':
                this.cmdCd(args);
                break;
            case 'type':
            case 'cat': // 兼容
                this.cmdType(args);
                break;
            case 'doskey':
                this.cmdDoskey(args);
                break;
            case 'unlock':
                this.cmdUnlock(args);
                break;
            case 'exit':
                this.cmdExit();
                break;
            default:
                this.print(`Bad command or file name`, 'error');
        }
        
        this.printPrompt();
    }

    handleTabCompletion() {
        const input = this.terminalInput.value;
        
        if (!this.tabState.isActive) {
            // 简单的参数解析：取最后一个空格后的内容作为前缀
            const lastSpaceIndex = input.lastIndexOf(' ');
            const prefix = lastSpaceIndex === -1 ? input : input.slice(lastSpaceIndex + 1);
            const basePath = lastSpaceIndex === -1 ? '' : input.slice(0, lastSpaceIndex + 1);
            
            // 获取当前目录文件
            const dir = this.fileSystem[this.currentPath];
            if (!dir) return;
            
            // 查找匹配项 (不区分大小写)
            const candidates = Object.keys(dir).filter(name => 
                name.toLowerCase().startsWith(prefix.toLowerCase())
            );
            
            if (candidates.length === 0) return;
            
            this.tabState.matches = candidates;
            this.tabState.index = 0;
            this.tabState.isActive = true;
            this.tabState.basePath = basePath;
        } else {
            // 循环切换下一个匹配项
            this.tabState.index = (this.tabState.index + 1) % this.tabState.matches.length;
        }
        
        // 应用匹配项
        const match = this.tabState.matches[this.tabState.index];
        this.terminalInput.value = this.tabState.basePath + match;
        
        // 移动光标到末尾并更新显示
        this.terminalInput.selectionStart = this.terminalInput.selectionEnd = this.terminalInput.value.length;
        this.updateInputDisplay();
    }
    
    navigateHistory(direction) {
        this.historyIndex += direction;
        this.historyIndex = Math.max(-1, Math.min(this.commandHistory.length, this.historyIndex));
        
        if (this.historyIndex >= 0 && this.historyIndex < this.commandHistory.length) {
            this.terminalInput.value = this.commandHistory[this.historyIndex];
        } else {
            this.terminalInput.value = '';
        }
        
        // 移动光标到末尾
        setTimeout(() => {
             if (this.terminalInput) {
                 this.terminalInput.selectionStart = this.terminalInput.selectionEnd = this.terminalInput.value.length;
                 this.updateInputDisplay();
             }
        }, 0);
    }
    
    // 命令实现
    cmdHelp() {
        this.print('For more information on a specific command, type HELP command-name');
        this.print('CD             Displays the name of or changes the current directory.');
        this.print('CLS            Clears the screen.');
        this.print('COPY           Copies one or more files to another location.');
        this.print('DIR            Displays a list of files and subdirectories in a directory.');
        this.print('EXIT           Quits the CMD.EXE program (closes window).');
        this.print('HELP           Provides Help information for Windows commands.');
        this.print('TYPE           Displays the contents of a text file.');
        this.print('UNLOCK         [Custom] Unlock protected content.');
        this.print('VER            Displays the Windows version.');
        this.print('');
    }
    
    cmdCls() {
        this.terminalOutput.innerHTML = '';
    }
    
    cmdVer() {
        this.print('');
        this.print('Windows 98 [Version 4.10.1998]');
        this.print('');
    }
    
    cmdDir(args) {
        const dir = this.fileSystem[this.currentPath];
        
        if (!dir) {
            this.print('Volume in drive C is WINDOWS98');
            this.print('Volume Serial Number is 1998-0625');
            this.print('File Not Found');
            return;
        }
        
        this.print('');
        this.print(' Volume in drive C is WINDOWS98');
        this.print(' Volume Serial Number is 1998-0625');
        this.print(` Directory of ${this.currentPath}`);
        this.print('');

        let fileCount = 0;
        let dirCount = 0;

        // 添加 . 和 ..
        this.print('.\t\t<DIR>\t\t12-18-25  12:00p');
        this.print('..\t\t<DIR>\t\t12-18-25  12:00p');
        dirCount += 2;

        Object.keys(dir).forEach(name => {
            const entry = dir[name];
            // 修复：null 也是 object，但在这里代表特殊文件
            const isDir = entry !== null && typeof entry === 'object' && !Array.isArray(entry);
            
            // 格式化输出
            let line = name.padEnd(15, ' ');
            if (isDir) {
                line += '<DIR>     ';
                dirCount++;
            } else {
                line += '          '; // 文件大小占位
                fileCount++;
            }
            line += '\t12-18-25  12:00p';
            
            this.print(line, 'output');
        });
        
        this.print(`         ${fileCount} file(s)              0 bytes`);
        this.print(`         ${dirCount} dir(s)        2,048,000 bytes free`);
        this.print('');
    }
    
    cmdCd(args) {
        if (args.length === 0) {
            this.print(this.currentPath);
            return;
        }
        
        let target = args[0].toUpperCase(); // DOS 不区分大小写
        
        // 处理 ..
        if (target === '..') {
            const parts = this.currentPath.split('\\').filter(p => p);
            if (parts.length > 1) { // 至少保留 C:
                parts.pop();
                this.currentPath = parts.join('\\');
                // 确保根目录格式正确 (C: -> C:\)
                if (this.currentPath.endsWith(':')) {
                    this.currentPath += '\\';
                }
            }
            return;
        }
        
        // 处理 .
        if (target === '.') return;

        // 处理绝对路径 (简单处理)
        if (target.startsWith('C:\\')) {
            if (this.fileSystem[target]) {
                this.currentPath = target;
            } else {
                this.print('Invalid directory');
            }
            return;
        }

        // 处理相对路径
        // 移除末尾的反斜杠
        if (target.endsWith('\\')) target = target.slice(0, -1);

        const newPath = this.currentPath.endsWith('\\') 
            ? `${this.currentPath}${target}` 
            : `${this.currentPath}\\${target}`;
            
        if (this.fileSystem[newPath]) {
            this.currentPath = newPath;
        } else {
            this.print('Invalid directory');
        }
    }
    
    cmdType(args) {
        if (args.length === 0) {
            this.print('The syntax of the command is incorrect.');
            return;
        }
        
        const filename = args[0].toUpperCase();
        const dir = this.fileSystem[this.currentPath];
        
        if (!dir || !(filename in dir)) {
            this.print('File not found');
            return;
        }
        
        // 特殊处理 diary.bin
        if (filename === 'DIARY.BIN') {
            this.typeDiaryBin();
            return;
        }
        
        const content = dir[filename];
        if (typeof content === 'string') {
            this.print('');
            content.split('\n').forEach(line => this.print(line));
            this.print('');
        } else {
            this.print('Access is denied.');
        }
    }
    
    cmdExit() {
        // 关闭窗口
        if (window.closeWindow) {
            window.closeWindow('window-cmd');
        }
    }
    
    typeDiaryBin() {
        if (!this.radioTokenFound) {
            // 完全未解锁
            this.print('');
            // 模拟二进制乱码
            this.print('▒▓█░▒▓█░▒▓█░▒▓█░▒▓█░▒▓█░', 'error');
            this.print('Error: File is encrypted or corrupted.', 'error');
            this.print('');
            this.print('Hint: Some codes are not in files.', 'hint');
            this.print('      They are where you would not expect...', 'hint');
            this.print('');
            
            // 通知桌宠该说话了
            if (window.desktopPet && !window.desktopPet.radioHintGiven) {
                setTimeout(() => {
                    window.desktopPet.giveRadioHint();
                }, 3000);
            }
        } else {
            // 完全解锁
            this.showFullDiary();
        }
    }
    
    showFullDiary() {
        this.print('');
        this.print('===========================================', 'system');
        this.print('  DIARY.BIN: DECRYPTED', 'success');
        this.print('===========================================', 'system');
        this.print('');
        this.print('Entry 001 - 2025.11.28', 'output');
        this.print('');
        this.print('今天写了一些代码，调试了很久。', 'output');
        this.print('有时候觉得，编程就像解谜，');
        this.print('你以为看到了全部，其实只看到了表面。', 'output');
        this.print('');
        this.print('Entry 002 - 2025.12.03', 'output');
        this.print('');
        this.print('做了这个网站，想把一些东西藏起来。', 'output');
        this.print('不是不想分享，只是想让真正好奇的人', 'output');
        this.print('通过自己的探索找到它们。', 'output');
        this.print('');
        this.print('就像当年玩游戏找隐藏关卡一样，', 'output');
        this.print('那种发现的快感，才是最珍贵的。', 'output');
        this.print('');
        this.print('Entry 003 - 2025.12.15', 'output');
        this.print('');
        this.print('如果你看到这里，说明你找到了所有线索。', 'output');
        this.print('恭喜你！你是一个真正的探险家。', 'output');
        this.print('');
        this.print('这个世界上，表面的东西太多了，', 'output');
        this.print('但真正有趣的，往往藏在深处。', 'output');
        this.print('');
        this.print('希望你在这里找到的，不只是我的随笔，', 'output');
        this.print('更是那种探索和发现的乐趣。', 'output');
        this.print('');
        this.print('Keep exploring. Keep being curious.', 'success');
        this.print('');
        
        this.print('Entry 004 - [SECRET REPO]', 'output');
        this.print('');
        this.print('I have set up a private repository access.', 'output');
        this.print('Use this link to view my private thoughts:', 'output');
        this.print('this is your own discovery, handle it with care, don\'t share it.', 'output');
        this.print('');
        
        const token = this.acceptedKey || 'YOUR_KEY';
        const url = `https://blankke.caozc1108.workers.dev/?token=${token}`;
        
        // Manually create link element
        const line = document.createElement('div');
        line.className = 'terminal-line terminal-output';
        const link = document.createElement('span');
        link.textContent = url;
        link.style.color = '#fff';
        link.style.textDecoration = 'underline';
        link.style.cursor = 'pointer';
        
        link.onclick = () => {
            if (window.openBrowser) {
                window.openBrowser(url);
            } else {
                window.open(url, '_blank');
            }
        };
        
        line.appendChild(link);
        this.terminalOutput.appendChild(line);
        this.scrollToBottom();

        this.print('');
        this.print('NOTE: If the link shows "Access Denied",', 'hint');
        this.print('the token you used might be the wrong one.', 'hint');
        this.print('The correct token is 8 characters long.', 'hint');
        this.print('');
        this.print('===========================================', 'system');
        this.print('');
    }
    
    cmdDoskey(args) {
        if (args.length > 0 && args[0].toLowerCase() === '/history') {
            this.print('');
            // 显示预设历史 + 用户历史
            const allHistory = [...this.presetHistory, ...this.commandHistory];
            allHistory.forEach((cmd) => {
                this.print(`${cmd}`, 'output');
            });
            this.print('');
        } else {
            // 简化版 doskey，只支持 /history
            this.print('DOSKey installed.');
        }
    }
    
    cmdUnlock(args) {
        if (args.length === 0) {
            this.print('Required parameter missing.');
            return;
        }
        
        const key = args.join(' ');
        this.verifyToken(key);
    }
    
    // 计算字符串的 SHA-256 哈希
    async sha256(message) {
        const msgBuffer = new TextEncoder().encode(message.toLowerCase());
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }
    
    // 验证 token
    async verifyToken(key) {
        // 预计算的正确密码哈希值
        // 这些是正确答案的哈希，无法逆推出原始密码
        const validHashes = [
            'ec3342ecaf2976284a04d98782f1dfec89fda8cb830536dfd524130f6c24582b', // 正确答案1
            '40c0c90393f2e54af78d7776561705833a6d4b09489f9e633575d07196d7466e'  // 正确答案2
        ];
        
        try {
            const hash = await this.sha256(key);
            
            if (validHashes.includes(hash)) {
                this.acceptedKey = key;
                if (!this.radioTokenFound) {
                    this.radioTokenFound = true;
                    this.print('');
                    this.print('Permission Granted.', 'success');
                    this.print('');
                    this.print('You can now read the full diary.', 'hint');
                    this.print('Try: TYPE DIARY.BIN', 'hint');
                    this.print('');
                    
                    // 通知桌宠
                    if (window.desktopPet) {
                        window.desktopPet.triggerDialog('secret_found');
                    }
                } else {
                    this.print('Key already accepted.', 'hint');
                }
            } else {
                this.print('Permission Denied.', 'error');
            }
        } catch (e) {
            this.print('System Error.', 'error');
            console.error('Token verification error:', e);
        }
    }
    
    // 被调用时解锁第一层（快捷键本身就是第一个 token）
    unlockFirstLayer() {
        if (!this.unlocked) {
            this.unlocked = true;
            setTimeout(() => {
                this.print('');
                this.print('===========================================', 'system');
                this.print('  System Interrupt', 'system');
                this.print('===========================================', 'system');
                this.print('');
                this.print('Hidden interface activated.', 'success');
                this.print('Primary lock disengaged.', 'output');
                this.print('');
                this.printPrompt();
            }, 500);
        }
    }
}

// 全局实例
window.terminal = null;
