Page({
  data: {
    currentType: 'bravery',
    
    braveryScore: 60,
    selfcareScore: 0,
    braveryPercent: 60,
    selfcarePercent: 0,
    
    braveryLevel: 0,
    selfcareLevel: 0,
    braveryBadgeIcon: '🌱',
    selfcareBadgeIcon: '🌱',
    braveryBadgeName: '木头勇士',
    selfcareBadgeName: '木头达人',
    braveryBadgeLevel: 'Lv.1 木头',
    selfcareBadgeLevel: 'Lv.1 木头',
    
    braveryRoadmap: [],
    selfcareRoadmap: [],
    
    braveryInput: '',
    selfcareInput: '',
    braveryEvent: '',
    selfcareEvent: '',
    
    records: [],
    filteredRecords: [],
    filterType: 'all',
    
    braveryColor: '#ff6b6b',
    selfcareColor: '#4ecdc4'
  },

  levels: ['木头', '石头', '黑铁', '青铜', '白银', '黄金', '铂金', '水晶', '钻石', '王者'],

  onLoad() {
    const saved = wx.getStorageSync('growthData');
    if (saved) {
      this.setData({
        braveryScore: saved.braveryScore,
        selfcareScore: saved.selfcareScore,
        braveryLevel: saved.braveryLevel,
        selfcareLevel: saved.selfcareLevel,
        records: saved.records || []
      });
    }
    this.updateUI();
  },

  switchType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ currentType: type });
  },

  onQuickInput(e) {
    const value = e.currentTarget.dataset.value;
    const type = this.data.currentType;
    this.setData({ [type + 'Input']: value.toString() });
  },

  onScoreInput(e) {
    const type = this.data.currentType;
    this.setData({ [type + 'Input']: e.detail.value });
  },

  onEventInput(e) {
    const type = this.data.currentType;
    this.setData({ [type + 'Event']: e.detail.value });
  },

  doChange(action) {
    const type = this.data.currentType;
    const input = this.data[type + 'Input'];
    const eventText = this.data[type + 'Event'];
    const amount = parseInt(input);

    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入有效分数', icon: 'none', duration: 1500 });
      return;
    }

    const delta = action === 'add' ? amount : -amount;
    
    // 检查扣分下限：Lv.0时不能再低
    if (type === 'bravery') {
      if (this.data.braveryLevel === 0 && this.data.braveryScore <= 60 && delta < 0) {
        wx.showToast({ title: '勇气分已达最低', icon: 'none', duration: 1500 });
        return;
      }
    } else {
      if (this.data.selfcareLevel === 0 && this.data.selfcareScore <= 0 && delta < 0) {
        wx.showToast({ title: '自理分已达最低', icon: 'none', duration: 1500 });
        return;
      }
    }

    this.changeScore(type, delta, eventText);
  },

  changeScore(type, delta, eventText) {
    const scoreKey = type + 'Score';
    const levelKey = type + 'Level';
    const threshold = type === 'bravery' ? 100 : 60;
    const startScore = type === 'bravery' ? 60 : 0;
    
    let newScore = this.data[scoreKey] + delta;
    let newLevel = this.data[levelKey];
    let upgraded = false;

    // 升级：分数 >= 100(勇气) 或 >= 60(自理) 时升级
    // 超出部分带入下一级起始分
    while (newScore >= threshold && newLevel < 9) {
      const overflow = newScore - threshold;
      newLevel++;
      newScore = startScore + overflow;
      upgraded = true;
    }

    // 降级：分数 < 60(勇气) 或 < 0(自理) 时降级
    // 从上一级借分：上一级满额减去缺少的部分
    while (newScore < startScore && newLevel > 0) {
      const shortage = startScore - newScore;
      newLevel--;
      newScore = threshold - shortage;
    }

    // Lv.0时分数不能低于起始分
    if (newLevel === 0 && newScore < startScore) {
      newScore = startScore;
    }

    // 最高等级不能再升，分数封顶
    if (newLevel === 9 && newScore >= threshold) {
      newScore = threshold - 1;
    }

    if (upgraded) {
      const levelName = this.levels[newLevel];
      wx.showModal({
        title: '🎉 恭喜升级！',
        content: `升级为 ${levelName}${type === 'bravery' ? '勇士' : '达人'}！`,
        showCancel: false,
        confirmText: '太棒了'
      });
    }

    const isMinus = delta < 0;
    const defaultEvent = type === 'bravery' 
      ? (isMinus ? '勇气扣分' : '勇气加分') 
      : (isMinus ? '自理扣分' : '自理加分');
    const record = {
      id: Date.now(),
      type: type,
      amount: delta,
      event: eventText || defaultEvent,
      time: this.formatTime(new Date())
    };

    const records = [record, ...this.data.records];

    this.setData({
      [scoreKey]: newScore,
      [levelKey]: newLevel,
      records: records,
      [type + 'Input']: '',
      [type + 'Event']: ''
    });

    this.updateUI();
    this.saveData();
  },

  onBraveryAdd() { this.doChange('add'); },
  onBraveryMinus() { this.doChange('minus'); },
  onSelfcareAdd() { this.doChange('add'); },
  onSelfcareMinus() { this.doChange('minus'); },

  updateUI() {
    // 进度条：勇气分范围[60,100)进度=(分数-60)/40，自理分范围[0,60)进度=分数/60
    const braveryPercent = Math.min(100, ((this.data.braveryScore - 60) / 40) * 100);
    const selfcarePercent = Math.min(100, (this.data.selfcareScore / 60) * 100);

    const braveryBadgeIcon = this.getBadgeIcon(this.data.braveryLevel);
    const selfcareBadgeIcon = this.getBadgeIcon(this.data.selfcareLevel);
    const braveryBadgeName = this.levels[this.data.braveryLevel] + '勇士';
    const selfcareBadgeName = this.levels[this.data.selfcareLevel] + '达人';

    const braveryRoadmap = this.levels.map((name, i) => ({
      name: name,
      status: i < this.data.braveryLevel ? 'passed' : (i === this.data.braveryLevel ? 'current' : 'locked')
    }));

    const selfcareRoadmap = this.levels.map((name, i) => ({
      name: name,
      status: i < this.data.selfcareLevel ? 'passed' : (i === this.data.selfcareLevel ? 'current' : 'locked')
    }));

    this.setData({
      braveryPercent,
      selfcarePercent,
      braveryBadgeIcon,
      selfcareBadgeIcon,
      braveryBadgeName,
      selfcareBadgeName,
      braveryBadgeLevel: 'Lv.' + (this.data.braveryLevel + 1) + ' ' + this.levels[this.data.braveryLevel],
      selfcareBadgeLevel: 'Lv.' + (this.data.selfcareLevel + 1) + ' ' + this.levels[this.data.selfcareLevel],
      braveryRoadmap,
      selfcareRoadmap
    });

    this.updateFilteredRecords();
  },

  getBadgeIcon(level) {
    const icons = ['🌱', '🪨', '⚔️', '🏺', '🥈', '🏆', '💎', '💠', '💎', '👑'];
    return icons[level] || '🌱';
  },

  formatTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    return `${year}/${month}/${day} ${hour}:${minute}:${second}`;
  },

  updateFilteredRecords() {
    const filterType = this.data.filterType;
    let filtered = this.data.records;
    if (filterType !== 'all') {
      filtered = filtered.filter(r => r.type === filterType);
    }
    this.setData({ filteredRecords: filtered });
  },

  setFilter(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ filterType: type });
    this.updateFilteredRecords();
  },

  onRecordLongPress(e) {
    const recordId = e.currentTarget.dataset.id;
    const that = this;
    wx.showModal({
      title: '',
      content: '',
      editable: true,
      placeholderText: '请输口令',
      confirmText: '删除',
      confirmColor: '#ff6b6b',
      success(res) {
        if (res.confirm && res.content === '0802') {
          // 删除该记录，并回退分数
          const records = that.data.records;
          const record = records.find(r => r.id === recordId);
          if (!record) return;

          const type = record.type;
          const scoreKey = type + 'Score';
          const levelKey = type + 'Level';
          const threshold = type === 'bravery' ? 100 : 60;
          const startScore = type === 'bravery' ? 60 : 0;

          // 回退分数（与 changeScore 相同的范围规则）
          let newScore = that.data[scoreKey] - record.amount;
          let newLevel = that.data[levelKey];

          // 处理升级：分数 >= threshold 时升级
          while (newScore >= threshold && newLevel < 9) {
            const overflow = newScore - threshold;
            newLevel++;
            newScore = startScore + overflow;
          }

          // 处理降级：分数 < startScore 时降级
          while (newScore < startScore && newLevel > 0) {
            const shortage = startScore - newScore;
            newLevel--;
            newScore = threshold - shortage;
          }

          // Lv.0时分数不能低于起始分
          if (newLevel === 0 && newScore < startScore) {
            newScore = startScore;
          }

          // 最高等级分数封顶
          if (newLevel === 9 && newScore >= threshold) {
            newScore = threshold - 1;
          }

          // 从记录列表中移除
          const newRecords = records.filter(r => r.id !== recordId);

          that.setData({
            [scoreKey]: newScore,
            [levelKey]: newLevel,
            records: newRecords
          });
          that.updateUI();
          that.saveData();

          wx.showToast({ title: '已删除', icon: 'success', duration: 1000 });
        } else if (res.confirm && res.content !== '0802') {
          wx.showToast({ title: '口令错误', icon: 'none', duration: 1500 });
        }
      }
    });
  },

  saveData() {
    wx.setStorageSync('growthData', {
      braveryScore: this.data.braveryScore,
      selfcareScore: this.data.selfcareScore,
      braveryLevel: this.data.braveryLevel,
      selfcareLevel: this.data.selfcareLevel,
      records: this.data.records
    });
  },

  // 导出数据
  onExportData() {
    const savedData = wx.getStorageSync('growthData');
    if (!savedData) {
      wx.showToast({ title: '暂无数据可导出', icon: 'none', duration: 1500 });
      return;
    }

    const exportData = {
      version: '1.0',
      exportTime: this.formatTime(new Date()),
      appName: '饭团英雄之旅',
      data: savedData
    };

    const jsonStr = JSON.stringify(exportData);
    const fileName = `饭团英雄数据_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.json`;

    // 写入临时文件
    const fs = wx.getFileSystemManager();
    const tempFilePath = `${wx.env.USER_DATA_PATH}/${fileName}`;

    fs.writeFile({
      filePath: tempFilePath,
      data: jsonStr,
      encoding: 'utf8',
      success: () => {
        // 尝试保存到磁盘
        wx.saveFileToDisk({
          filePath: tempFilePath,
          success: () => {
            wx.showToast({ title: '已保存文件', icon: 'success' });
          },
          fail: () => {
            // 保存失败，改为分享给好友
            wx.showModal({
              title: '保存失败',
              content: '是否发送给微信好友保存？换手机后可在聊天记录中导入。',
              confirmText: '发送',
              success: (res) => {
                if (res.confirm) {
                  wx.shareFileMessage({
                    filePath: tempFilePath,
                    fileName: fileName,
                    success: () => {
                      wx.showToast({ title: '已发送', icon: 'success' });
                    },
                    fail: () => {
                      // 分享也失败，复制内容
                      wx.setClipboardData({
                        data: jsonStr,
                        success: () => {
                          wx.showToast({ title: '已复制到剪贴板，请粘贴保存', icon: 'none', duration: 2500 });
                        }
                      });
                    }
                  });
                }
              }
            });
          }
        });
      },
      fail: () => {
        wx.showToast({ title: '导出失败', icon: 'none' });
      }
    });
  },

  // 导入数据
  onImportData() {
    wx.showModal({
      title: '导入数据',
      content: '导入将覆盖当前所有数据，确定继续吗？',
      confirmText: '继续',
      success: (res) => {
        if (!res.confirm) return;

        // 从微信聊天选择文件
        wx.chooseMessageFile({
          count: 1,
          type: 'file',
          extension: ['json'],
          success: (res) => {
            const filePath = res.tempFiles[0].path;
            const fs = wx.getFileSystemManager();

            fs.readFile({
              filePath: filePath,
              encoding: 'utf8',
              success: (content) => {
                try {
                  const importData = JSON.parse(content.data);

                  // 验证数据格式
                  if (!importData.version || !importData.data) {
                    throw new Error('格式错误');
                  }

                  const savedData = importData.data;

                  this.setData({
                    braveryScore: savedData.braveryScore,
                    selfcareScore: savedData.selfcareScore,
                    braveryLevel: savedData.braveryLevel,
                    selfcareLevel: savedData.selfcareLevel,
                    records: savedData.records || []
                  });

                  wx.setStorageSync('growthData', savedData);
                  this.updateUI();

                  wx.showToast({ title: '导入成功', icon: 'success' });
                } catch (e) {
                  wx.showToast({ title: '导入失败：文件格式错误', icon: 'none', duration: 2000 });
                }
              },
              fail: () => {
                wx.showToast({ title: '读取文件失败', icon: 'none' });
              }
            });
          }
        });
      }
    });
  }
});
