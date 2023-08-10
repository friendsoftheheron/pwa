// https://github.com/PhraseApp-Blog/javascript-l10n-ultimate-guide/blob/main/vanilla/js/scripts.js
// https://phrase.com/blog/posts/step-step-guide-javascript-localization/

export default class I18N {
    constructor() {}

    static default = 'en';
    static selector_id = 'language';

    static _supported_url = './lang/lang.json';
    static _translations_url = './lang/@@.json';
    static _supported_locales = null;


    static _locale = '';

    static supported_url = this._supported_url;
    static translations_url = this._translations_url;

    static translations = {}

    static get supported_locales() {
        return new Promise((resolve, reject) =>
        {
            if (this._supported_locales) {
                return resolve(this._supported_locales);
            }
            this._supported_locales = false;
            fetch(this.supported_url)
                .then(res => res.json())
                .then(json => resolve(this._supported_locales ||= json))
                .catch(err => reject(err))
        });
    }

    static get locale() { return this._locale; };

    static set locale(locale)  {
        if (locale === this._locale) { return; }
        document.getElementsByTagName('html')[0].setAttribute('lang', locale);
        this.setTranslations(locale).then(() => this._locale = locale);
    }

    static setTranslation = (label, content) => {
        this.translations[label] = content;
        this.translate();
    }

    static setTranslations = (locale = this.locale) => new Promise((resolve, reject) => {
        if ('' === locale) { return reject('No locale set') }
        fetch(this.translations_url.replace('@@', locale.replaceAll(/\W/g, '')))
            .then(res => res.json())
            .then(json => {
                this.translations = json;
                this.translate();
                resolve(I18N.translations);
            })
            .catch(err => reject(err))
        ;
    });

    static getContent = (key, elem) => {
        if (key.endsWith('_p')) {
            return this.translations[key] &&
                this.translations[key][
                    new Intl
                        .PluralRules(this.locale || undefined)
                        .select(+elem.dataset.i18nValue)
                ]
            ;
        }
        return this.translations[key];
    }

    static parse = (str, elem) => {
        return str.replaceAll(
            /\((\w+|\*|\/|\$)\)\[([^\]]*)]/g,
            (_, key, text) => {
                switch (key) {
                    case '*': return '<b>'+text+'</b>';
                    case '/': return '<i>'+text+'</i>';
                    case '$': return elem.dataset.i18nValue;
                    default:
                        const data = elem.dataset['i18nTag'+key[0].toUpperCase() + key.slice(1)]
                        if (!data) return `(${key})[${text}]`
                        const json = JSON.parse(data);
                        const tag = document.createElement(json.tag || 'span')
                        Object.entries(json.attr || {}).forEach(([key, value]) => {
                            tag.setAttribute(key, value);
                        })
                        tag.innerHTML = text || json.content || '';
                        return tag.outerHTML;
                }
            }
        )
    }

    static translateElement = (elem) => {
        const content = I18N.getContent(elem.dataset.i18nKey, elem);
        if (undefined === content) {
            elem.classList.add('i18n-untranslated')
        } else {
            elem.classList.remove('i18n-untranslated')
            if ('i18nAttr' in elem.dataset) {
                elem.setAttribute(
                    elem.dataset.i18nAttr,
                    this.parse(content)
                );
            } else {
                elem.innerHTML = this.parse(content, elem);
            }
        }
        const span = document.createElement('span');
        span.classList.add('i18n-edit');
        span.dataset.i18nEditKey = elem.dataset.i18nKey;

        if (['OPTION'].includes(elem.tagName)) { return;  } // Options are difficult to handle
        if (['BUTTON', 'TEXTAREA'].includes(elem.tagName)) {
            if (
                null === elem.nextSibling ||
                elem.nextSibling.nodeType !== Node.ELEMENT_NODE ||
                !elem.nextSibling.dataset.i18nEditKey ||
                elem.nextSibling.dataset.i18nEditKey !== span.dataset.i18nEditKey
            ) {
                elem.classList.forEach(c => {
                    if (['left', 'margin', 'right', 'debug']) {
                        span.classList.add(c)
                    } else {
                        console.log('cl', c)
                    }
                });
                elem.parentNode.insertBefore(span, elem.nextSibling);
            }
        } else if (
            null === elem.lastChild ||
            elem.lastChild.nodeType !== Node.ELEMENT_NODE ||
            !elem.lastChild.classList.contains('i18n-edit')
        ) {
            elem.appendChild(span);
        }
    }

    static translate = (elem = null) => {
        if (null === elem) { elem = document; }
        elem
            .querySelectorAll('[data-i18n-key]')
            .forEach(elem => this.translateElement(elem))
        ;
    }

    static translateHtml = (html) => {
        const div = document.createElement('div');
        div.innerHTML = html;
        this.translate(div)
        return div.innerHTML;
    }

    static addLanguageToSelector = (key, select, selected= false) => {
        this.supported_locales.then(supported_locales => {
            if ((key in supported_locales) && (!this._supported_locales[key].added)) {
                this._supported_locales[key].added = true;
                const option = document.createElement('option')
                option.value = key;
                option.selected = selected;
                option.innerText = supported_locales[key].flag + ' ' + supported_locales[key].language;
                option.classList.add('lang')
                select.append(option)
            }
        });
    }

    static setLanguageSelector = (selector_id= this.selector_id, locale = '') => new Promise((resolve, reject) => {
        const select = document.getElementById(selector_id);
        if (!select) { return reject('No select Element: '+selector_id); }
        select.innerHTML = '';
        Promise
            .all(navigator.languages.map(key => this.addLanguageToSelector(key, select, key === locale)))
            .then(()=>this.supported_locales)
            .then(supported_locales => Promise.all(
                Object.keys(supported_locales).map(key => this.addLanguageToSelector(key, select, key === locale))
            ))
            .then(res => resolve(res))
        ;
    })

}

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('i18n-edit')) {
        e.preventDefault();
        const event = new Event(
            'translate',
            {
                view: window,
                bubbles: true,
                cancelable: true,
            }
        );
        if (e.target.parentNode.dataset.i18nKey) {
            e.target.parentNode.dispatchEvent(event);
        } else {
            e.target.previousSibling.dispatchEvent(event);
        }
    }
    return false;
 })


document.addEventListener('change', (e) => {
    if (e.target.id === I18N.selector_id) {
        I18N.locale = e.target.value;
    }
})

document.addEventListener('i18n-translate', (e) => {
    I18N.translate(e.target);
})
document.addEventListener('i18n-translate-element', (e) => {
    I18N.translateElement(e.target);
})
