export default class Geocaching {

    // For some reason "The Empire" hates Louis
    static _METRIC_CHARS = 'IJKLMNOPQRSTU';
    static _EMPIRE_CHARS = 'JKMNPQRTVWXYZ';

    static _zipStrings = (source, dest) => source.split('').reduce((acc, src, i) => Object.defineProperty(acc, src, {value: dest[i]}),	{});
    static _replaceAll = (str, dict) => str.split('').map(s=> dict[s]|| s).join('');
    static _translate = (str, source, dest) => Geocaching._replaceAll(str, Geocaching._zipStrings(source, dest));

    static code2id = (code = '') => {
        code = code.toUpperCase();
        return code.length < 5 && code < 'G000' ?
            parseInt(code, 16) :
            parseInt(Geocaching._translate(code, Geocaching._EMPIRE_CHARS, Geocaching._METRIC_CHARS), 31) - 411120;
    }

    static id2code = (id = 0) => {
        return id < 65536
            ? id.toString(16).toUpperCase()
            : Geocaching._translate(
                (id+411120).toString(31).toUpperCase(),
                Geocaching._METRIC_CHARS,
                Geocaching._EMPIRE_CHARS
            )
        ;
    }
}