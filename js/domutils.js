import i18n from './i18n.js'

export default class DomUtils {
    static camelcaseify = (str) => str.replace(/-([a-z])/g, g =>  g[1].toUpperCase());
    static renderTemplate = (template, obj) =>
        template.replace(/\${(\w+)}/g, (_, k) =>
            obj.hasOwnProperty(k) ? obj[k] : '${'+k+'}'
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
                console.error("Element not found: " + str)
            }
            return elem;
        }
        return str;
    }

    static getElementByClassName = (name, node=null, number=0) => {
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
            console.error(`du.dispatchEvent(${elem}, ${type})`)
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

    static getElementValue = (elem) => {
        elem = this.elemOrId(elem);
        if (!elem) return;
        if (["radio", "checkbox"].includes(elem.type)) return elem.checked ? 'true' : '';
        return elem.value;
    }

    static setElementValue = (elem, value) => {
        elem = this.elemOrId(elem);
        if (!elem) return false;
        if (["radio", "checkbox"].includes(elem.type)) return elem.checked = value
        else return elem.value = value;
    }

    static setChecked = (elem, state = true) => {
        elem = this.elemOrId(elem);
        if (elem) {
            elem.checked = state;
            this.dispatchEvent(elem, "change");
        }
    }

    static setInnerHtml = (elem, html, obj=null) => {
        elem = this.elemOrId(elem);
        if (!elem) return;
        elem.innerHTML = html;
        i18n.translate(elem);
        if (obj) {
            elem.innerHTML = this.renderTemplate(elem.innerHTML, obj)
        }
        return 	html;
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
            .then(response => response.text())
            .then(data => resolve(data))
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
}
