document.addEventListener('DOMContentLoaded', function() {
    // 获取“出战背包”和“待命背包”的 DOM 元素
    var chuzhanBeibao = document.getElementById('chuzhan-beibao');
    var daimingBeibao = document.getElementById('daiming-beibao');

    // 我们需要一个临时变量，来记录被我们拖动覆盖的那个“目标精灵”
    let swappedItem = null;

    // 创建一个可复用的配置对象，这样两个背包的逻辑就完全一样了
    const sortableOptions = {
        group: 'shared-backpacks', // 组名必须相同才能互相拖动
        animation: 150,            // 动画效果
        ghostClass: 'sortable-ghost', // 拖动时占位符的样式

        /**
         * onMove: 当你拖着一个精灵，经过另一个精灵上方时就会触发。
         * 我们用这个事件来捕捉那个即将被交换的“目标精灵”。
         */
        onMove: function (evt) {
            // evt.related 就是被你拖动覆盖的那个“目标精灵”
            // 我们只在跨背包拖动时才记录它
            if (evt.from !== evt.to) {
                swappedItem = evt.related;
            }
        },

        /**
         * onEnd: 当你松开鼠标，拖动操作结束时触发。
         * 我们在这里执行最终的“交换”操作。
         */
        onEnd: function (evt) {
            // 确认这是一次跨背包的拖动，并且我们成功记录了要交换的“目标精灵”
            if (evt.from !== evt.to && swappedItem) {
                // evt.item 是你亲手拖动的那个精灵
                // swappedItem 是你想要交换的那个“目标精灵”

                // 在这一刻，SortableJS 已经自动把你的 evt.item 移动到了新的背包。
                // 我们现在需要做的，就是手动把那个“目标精灵”(swappedItem) 搬回到旧的背包里。
                
                // 我们把它插回到你拖动的精灵原来所在的位置 (evt.oldIndex)
                if (evt.from.children[evt.oldIndex]) {
                    evt.from.insertBefore(swappedItem, evt.from.children[evt.oldIndex]);
                } else {
                    evt.from.appendChild(swappedItem);
                }
            }
            
            // 操作完成后，清空临时变量，为下一次拖动做准备
            swappedItem = null;
        }
    };

    // 使用上面定义好的配置，来初始化两个背包
    new Sortable(chuzhanBeibao, sortableOptions);
    new Sortable(daimingBeibao, sortableOptions);
});