import DomUtils from "./domutils.js";

export default class DualRange {}

document.addEventListener('change', e => {
    if (
        'INPUT' === e.target.tagName &&
        'range' === e.target.type &&
        e.target.parentNode.classList.contains('dual-range')
    ) {
        const elem_range = e.target.parentNode;
        const elem_this = e.target.classList.contains('min') ? 'Min' : 'Max';
        const elem_that = e.target.classList.contains('min') ? 'Max' : 'Min';
        if (!('previous' + elem_this in elem_range.dataset)) {
            elem_range.dataset['previous' + elem_this] = e.target.value;
            if ('previous' + elem_that in elem_range.dataset) {
                elem_range.dataset['previous'] = elem_this;
                DomUtils.dispatchEvent(e.target, 'input');
                DomUtils.dispatchEvent(elem_range.querySelector('.' + elem_that.toLowerCase()), 'input');
            }
        }
        else if (elem_this !== elem_range.dataset['previous']) {
            DomUtils.dispatchEvent(
                elem_range.querySelector('.' + elem_that.toLowerCase()),
                'change'
            )
        }
    }
});

document.addEventListener('input', e => {
    if (
        'INPUT' === e.target.tagName &&
        'range' === e.target.type &&
        e.target.parentNode.classList.contains('dual-range')
    ) {
        const value = +e.target.value;
        const elem_range = e.target.parentNode;
        if (
            !('previousMin' in elem_range.dataset) ||
            !('previousMin' in elem_range.dataset)
        ) {
            console.error('Dual range: Not initialised')
            return false;
        }
        const elem = {
            Min: elem_range.querySelector('.min'),
            Max: elem_range.querySelector('.max'),
        }
        let elem_this = '';
        if (value < +elem_range.dataset.previousMin) { elem_this = 'Min'; }
        if (value > +elem_range.dataset.previousMax) { elem_this = 'Max'; }
        if (!elem_this &&
            (2 * value + (+elem['Min'].getAttribute('step') || 1) <
                +elem_range.dataset.previousMin + +elem_range.dataset.previousMax)
        ) { elem_this = 'Min'; }
        if (!elem_this &&
            (2 * value - (+elem['Max'].getAttribute('step') || 1) >
                +elem_range.dataset.previousMin + +elem_range.dataset.previousMax)
        ) { elem_this = 'Max'; }
        if (!elem_this) {
            elem_this = e.target.classList.contains('min') ? 'Min' : 'Max';
            elem_this = elem_range.dataset.previous;
        }
        elem_range.dataset.previous = elem_this;
        const elem_that = 'Min' === elem_this ? 'Max' : 'Min';
        elem_range.dataset['previous'+elem_this] = value;

        ['Min', 'Max'].forEach(x => {
            if (+elem[x].value !== +elem_range.dataset['previous'+x]) {
                elem[x].value = elem_range.dataset['previous'+x];
                DomUtils.dispatchEvent(elem[x], 'input');
                DomUtils.dispatchEvent(elem[x], 'change');
            }
        });

        elem[elem_this].focus();
        elem[elem_this].style.zIndex = 9991;
        elem[elem_that].style.zIndex = 9990;

        const value_min = +elem['Min'].getAttribute('min');
        const value_max = +elem['Max'].getAttribute('max');
        const percent_min = (elem['Min'].value - value_min) / (value_max - value_min) * 100;
        const percent_max = (elem['Max'].value - value_min) / (value_max - value_min) * 100;

        e.target.parentNode.style.backgroundImage = `linear-gradient(
            90deg, 
            var(--light-gray) 0, 
            var(--light-gray) ${percent_min}%, 
            var(--accent-color) ${percent_min}%, 
            var(--accent-color) ${percent_max}%,
            var(--light-gray) ${percent_max}%,
            var(--light-gray) 100%
        )`;
    }
});
