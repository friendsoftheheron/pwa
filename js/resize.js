export default class Resize {
    static client_x = 0;
    // To be implemented: Vertical resizing
    // static client_y = 0;
    static elem_this = null;
    static elem_prev = null;
    static min_width = 24;

    static onMouseDown = e => {
        let target = e.target;
        while(target) {
            if (target.classList && target.classList.contains('resizable')) {
                Resize.client_x = e.touches ? e.touches[0].clientX : e.clientX;
                //Resize.client_y = e.touches ? e.touches[0].clientY : e.clientY;
                Resize.elem_this = target;
                Resize.elem_prev = target.previousElementSibling;
                if (!Resize.elem_prev) {
                    console.error('Resizable: No previousElementSibling', Resize.elem_this);
                    Resize.elem_this = null;
                }
                Resize.elem_this.classList.add('dragging')

                // Setting absolute sizes when some are still relative gives interesting results.
                // To solve this we first store the values and then use them.
                Array.from(target.parentNode.children).forEach(node => {
                    node.dataset.bounds = JSON.stringify(node.getBoundingClientRect());
                });
                Array.from(target.parentNode.children).forEach(node => {
                    node.style.height = JSON.parse(node.dataset.bounds).height + 'px';
                    node.style.width = JSON.parse(node.dataset.bounds).width + 'px';
                })
                return false;
            }
            target = target.parentNode;
        }
    };

    static onMouseMove = e => {
        if (! Resize.elem_this) { return; }
        const bounding_this = Resize.elem_this.getBoundingClientRect();
        const bounding_prev = Resize.elem_prev.getBoundingClientRect();
        let delta_x = Resize.client_x - (e.touches ? e.touches[0].clientX : e.clientX);
        // let delta_y = e.clientY - e.touches ? e.touches[0].clientY : Resize.client_y;

        if (bounding_this.width + delta_x < Resize.min_width) {
            delta_x = Resize.min_width - bounding_this.width;
        }
        if (bounding_prev.width - delta_x < Resize.min_width) {
            delta_x = bounding_prev.width - Resize.min_width;
        }

        Resize.client_x = e.touches ? e.touches[0].clientX : e.clientX;
        //Resize.client_y = e.touches ? e.touches[0].clientY : e.clientY;

        Resize.elem_this.style.width = (bounding_this.width + delta_x) + 'px';
        Resize.elem_prev.style.width = (bounding_prev.width - delta_x) + 'px';
    };

    static onMouseUp = e => {
        Resize.elem_this &&
        Resize.elem_this.classList.remove('dragging')
        Resize.elem_this = null;
    };

}

document.addEventListener('mousedown', Resize.onMouseDown);
document.addEventListener('touchstart', Resize.onMouseDown);
document.addEventListener('mousemove', Resize.onMouseMove);
document.addEventListener('touchmove', Resize.onMouseMove);
document.addEventListener('mouseup', Resize.onMouseUp);
document.addEventListener('touchend', Resize.onMouseUp);
