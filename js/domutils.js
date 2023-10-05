export default class DomUtils {
    static timer = 0;

    static camelcaseify = (str) => str.replace(/-([a-z])/g, g => g[1].toUpperCase());
    static hash = (str) => Array.from(str).reduce((a, c) => ((a<<5) -a) + c.charCodeAt(0), 0);
    static renderTemplate = (template, obj) =>
        template.replace(/\${(\w+)}/g, (_, k) =>
            obj.hasOwnProperty(k) ? obj[k] : '${' + k + '}'
        )
    ;

    static escapeHTML = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static elemOrId = (str) => {
        if ("string" === typeof str) {
            const elem = document.getElementById(str)
            if (!elem) {
                console.warn("Element not found: " + str)
            }
            return elem;
        }
        return str;
    }

    static getElementByClassName = (name, node = null, number = 0) => {
        if (null === node) {
            node = document;
        }
        const elem = node.getElementsByClassName(name)
        if (!elem) {
            console.error('Class name not found');
            return null;
        }
        if (number >= elem.length) {
            console.error('Too few elements:' + elem.length);
            return null;
        }
        return elem[number];
    }

    // https://stackoverflow.com/questions/5525071/how-to-wait-until-an-element-exists
    static waitForSelector(selector) {
        return new Promise(resolve => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }

            const observer = new MutationObserver(() => {
                if (document.querySelector(selector)) {
                    resolve(document.querySelector(selector));
                    observer.disconnect();
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    }

    static dispatchEvent = (elem, type) => {
        elem = this.elemOrId(elem);
        if (!elem) {
            return;
        }
        const event = new InputEvent(
            type,
            {
                view: window,
                bubbles: true,
                cancelable: true,
                //target: elem,
            }
        );
        elem.dispatchEvent(event);
    }


    static isOverflow = (selector) => {
        let elem = document.querySelector(selector);
        while (elem) {
            const overflow = window
                .getComputedStyle(elem)
                .getPropertyValue('overflow')
            elem.style.overflow = 'hidden';
            if (elem.clientWidth && elem.scrollWidth && elem.clientHeight && elem.scrollHeight &&
                (elem.clientWidth < elem.scrollWidth || elem.clientHeight < elem.scrollHeight)
            ) {
                elem.style.overflow = overflow;
                return true;
            }
            elem.style.overflow = overflow;
            elem = (['div', 'header'].includes(elem.tagName.toLowerCase())) ? null : elem.parentNode;
        }
        return false;
    }

    static fitFont = (selector, factor = 0.95, extra = 0) => {
        const elem = document.querySelector(selector);
        if (!elem) {
            return;
        }
        let font_size = +window
            .getComputedStyle(elem)
            .getPropertyValue('font-size')
            .slice(0, -2);
        while (this.isOverflow(selector) && font_size && font_size > 1) {
            font_size *= factor;
            elem.style.fontSize = font_size + 'px';
        }
        font_size -= extra;
        elem.style.fontSize = font_size + 'px';
    }

    static getElementValue = (elem) => {
        elem = this.elemOrId(elem);
        if (!elem) return;
        if (["radio", "checkbox"].includes(elem.type)) return elem.checked ? elem.value : '';
        return elem.value;
    }

    static setElementValue = (elem, value) => {
        elem = this.elemOrId(elem);
        if (!elem) return false;
        if (["radio", "checkbox"].includes(elem.type)) {
            elem.checked = value;
        } else {
            elem.value = value;
        }
        this.dispatchEvent(elem, "change");
        return value;
    }

    static setChecked = (elem, state = true) => {
        elem = this.elemOrId(elem);
        if (elem && elem.checked !== state) {
            elem.checked = state;
            this.dispatchEvent(elem, "change");
        }
    }

    static getRadioValue = (name) => {
        return Array.from(
            document.querySelectorAll('input[type="radio"][name="'+name+'"]')
        ).filter(elem => elem.checked)[0].value;
    }

    static setRadioValue = (name, value) => {
        document
            .querySelectorAll('input[type="radio"][name="'+name+'"]')
            .forEach(elem => {
                elem.checked = elem.value == value;
            })
        ;
    }

    static setInnerHtml = (elem, html, obj=null) => {
        elem = this.elemOrId(elem);
        if (!elem) return;
        elem.innerHTML = html;
        if (obj) {
            elem.innerHTML = this.renderTemplate(elem.innerHTML, obj)
        }
        this.dispatchEvent(elem, 'i18n-translate');
        return html;
    };

    static setInnerHtmlByQuery = (query, html, node = null, obj=null) => {
        if (!node) {
            node = document
        }
        //document.querySelector('.titanic:nth-child(2)')
        const elem =  node.querySelector(query)
        if (!elem) return;
        return this.setInnerHtml(elem, html, obj)
    }

    static setSelectOptions = (elem, data) => {
        elem = this.elemOrId(elem);
        if (!elem) return;
        elem.innerHTML = '';
        data.forEach(d => {
            const option = document.createElement('option')
            const key = Object.keys(d)[0]
            option.value = DomUtils.escapeHTML(key)
            option.textContent = d[key]
            elem.append(option);
        })
    }

    static loadUrl = (url) => new Promise((resolve, reject) => {
        fetch(url)
            .then(response => {
                if (response.status < 400) {
                    resolve(response.text());
                } else {
                    reject({
                        error: response.statusText,
                        status: response.status,
                    });
                }
            })
            .catch(err => reject(err))
        ;
    });

    static loadUrlToElem = (elem, url, obj=null) => new Promise((resolve, reject) => {
        elem = this.elemOrId(elem);
        this.loadUrl(url)
            .then(data => resolve(this.setInnerHtml(elem, data, obj)))
            .catch(err => reject(err))
        ;
    });

    static htmlTitle = (str) => {
        str = str.replace(/_/g, ' ').trim()
        return str.charAt(0).toUpperCase() + str.slice(1)

    }

    static htmlFromArray = (data) => '' +
            '<table' + ('bar' in data[0] ? ' class="table-bar"' : '') + '>' +
            '<tr>' + Object.keys(data[0]).map((x) => `<th data-i18n-key="${('data-'+x).toLowerCase().replace(/(\s|_|-)+/g, '-')}">${DomUtils.htmlTitle(x)}</th>`).join('\n') + '</tr>' +
            data.map(x => '<tr>' + Object.values(x).map(
                x => `<td${isNaN(x)?'':' style="text-align:right"'}>${x}</td>`
            ).join('') + '</tr>').join('') +
            '</table>'
        ;
    static htmlFromObject = (data) => '' +
            '<table>' +
            Object.keys(data).map((x) => `<tr><th>${DomUtils.htmlTitle(x)}</th><td${isNaN(data[x])?'':' style="text-align:right"'}>${data[x]}</td></tr>`).join('\n') +
            '</table>'
        ;


    static htmlFromData = (data) => {
        if (Array.isArray(data)) {
            return DomUtils.htmlFromArray(data);
        }
        // First check array, because array is also an object (as is null)
        if (typeof data === 'object') {
            return DomUtils.htmlFromObject(data);
        }
        return data;
    }

    static onLabelForChecked = e => {
        let target = e.target;
        while (target && target.dataset) {
            const label = target.dataset.labelForChecked;
            if (label) {
                DomUtils.setChecked(label, true);
            }
            target = target.parentNode;
        }
    }

    static onLabelForUnchecked = e => {
        let target = e.target;
        while (target && target.dataset) {
            const label = target.dataset.labelForUnchecked;
            if (label) {
                DomUtils.setChecked(label, false);
            }
            target = target.parentNode;
        }
    }
}

document.addEventListener('mousedown', DomUtils.onLabelForChecked);
document.addEventListener('touchstart', DomUtils.onLabelForChecked);
document.addEventListener('mousedown', DomUtils.onLabelForUnchecked);
document.addEventListener('touchstart', DomUtils.onLabelForUnchecked);

document.addEventListener('input', (e) => {
    if ('INPUT' === e.target.tagName && 'range' === e.target.type) {
        document
            .querySelectorAll('[data-for-range="'+e.target.id+'"')
            .forEach(elem => {
                let value = +e.target.value;

                const larger_than =
                    elem.dataset.valueLargerThan &&
                    value === +e.target.getAttribute('max')
                if (larger_than) {
                    value -= e.target.getAttribute('step') || 1;
                }
                if ("valueToFixed" in elem.dataset) {
                    value = value.toFixed(+elem.dataset.valueToFixed);
                }
                if (larger_than) {
                    value = '>' + value;
                }

                if ("rangeAttr" in elem.dataset) {
                    elem.setAttribute(elem.dataset.rangeAttr, value.toString());
                } else {
                    elem.innerHTML = value.toString();
                }
                if ("rangeEvent" in elem.dataset) {
                    DomUtils.dispatchEvent(elem, elem.dataset.rangeEvent);
                }
            })
        ;
    }
});

document.addEventListener('click', e => {
    let target = e.target;
    let label;
    while (target && target.dataset) {
        label = target.dataset.labelForRadio;
        if (label) {
            const radios = document.getElementsByName(label);
            let radio_id = -1;
            radios.forEach((elem, i) => {
                if (elem.checked) { radio_id = i; }
            })
            DomUtils.setChecked(radios[(radio_id+1) % radios.length]);
        }

        label = target.dataset.labelForRangeDecrease;
        if (label) {
            const range = document.getElementById(label);
            if (range) {
                range.value = +range.value - (+range.getAttribute('step') || 1);
                DomUtils.dispatchEvent(range, 'input');
            }
        }

        label = target.dataset.labelForRangeIncrease;
        if (label) {
            console.warn('Label', label);
            const range = document.getElementById(label);
            if (range) {
                range.value = +range.value + (+range.getAttribute('step') || 1);
                DomUtils.dispatchEvent(range, 'input');
            }
        }

        target = target.parentNode;
    }
});

document.addEventListener('dblclick', (e) => {
    let target = e.target;
    while (target && target.dataset) {
        const source = target.dataset.dblclickSource;
        const classname = target.dataset.dblclickClass;
        if (source && classname) {
            document.querySelectorAll('[data-dblclick-target="' + source + '"]').forEach(elem => {
                if (elem.classList.contains(classname)) {
                    elem.classList.remove(classname);
                } else {
                    elem.classList.add(classname)
                }
            });
        }
        target = target.parentNode;
    }
});

document.addEventListener('input', (e) => {
    if (e.target.dataset.sourceUrl) {
        if (DomUtils.timer) {
            window.clearTimeout(DomUtils.timer);
        }
        DomUtils.timer = window.setTimeout(
            () => {
                if ('' === e.target.value) {
                    const holder = DomUtils.elemOrId(e.target.dataset.targetSelect)
                    if (holder) { holder.innerHTML = ''; }
                    return true;
                }
                DomUtils.timer = 0;
                fetch(
                    e.target.dataset.sourceUrl.replaceAll(
                        /\$\{(.*?)\}/g,
                        (x,y) => y.split('.').reduce((acc, x) => acc[x], window)
                    ) + encodeURIComponent(e.target.value)
                )
                    .then(res => res.json())
                    .then(json => {
                        const holder = DomUtils.elemOrId(e.target.dataset.targetSelect)
                        if (holder) {
                            holder.innerHTML = '';
                            json.forEach(x => {
                                const node = document.createElement('option')
                                node.text = x.username;
                                node.value = x.id;
                                holder.append(node);
                            })
                        }
                    })
                    .catch(err => console.error(err))
            },
            200
        );
    }
});

document.addEventListener('change', e => {
    if (e.target.dataset.targetSelect) {
        DomUtils.dispatchEvent(
            DomUtils.elemOrId(e.target.dataset.targetSelect),
            'change'
        );
    }
});