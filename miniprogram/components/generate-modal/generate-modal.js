Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    // 模式：generating=生成中，completed=已完成
    mode: {
      type: String,
      value: 'generating'
    },
    // 提示文案
    message: {
      type: String,
      value: ''
    }
  },
  methods: {
    // 确定按钮
    onConfirm() {
      this.triggerEvent('confirm');
    },
    // 去查看
    onView() {
      this.triggerEvent('view');
    },
    // 阻止冒泡
    stopPropagation() {}
  }
});
