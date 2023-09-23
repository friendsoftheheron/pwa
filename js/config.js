export default class Config {

    static name = 'Power Walk Adventure';
    static version = 'v0.5.0.2';

    // Heron Island S23.44240 E151.91500
    static start_latitude = -23.44240;
    static start_longitude = 151.91500;

    static username = '';
    static user_id = 0;
    static level = 0;
    static expire = '';
    static level_formatted = '';
    static expire_formatted = '';
    static translator_formatted = '';

    static get name_reduced() { return this.name.toLowerCase().replace(' ', '-'); }
    static get cache_name() { return this.name_reduced + '-' + this.version; }

    static home_url = location.href.split(/index.html|sw.js/)[0].replace(/\/$/, '');
    static data_url = 'https://heron.alwaysdata.net/data.json'
    static message_buffer = 50;

    static current_latitude = 'current_latitude';
    static current_longitude = 'current_longitude';
    static current_heading = 'current_heading'
    static current_timestamp = 'current_timestamp';
    static fetched_labs = 'fetch_labs';
    static fetched_latitude = 'fetch_latitude';
    static fetched_longitude = 'fetch_longitude';
    static fetched_timestamp = 'fetch_timestamp'; // Used with prefix fetched and a loop over the key
    static message_hash = 'message_hash';
    static filters_key = '_filter'

    static color = {
        'orange': '#f15927',
        'sky': '#cdeaf1',
        'light-blue': '#99d3df',
        'medium-blue': '#00708e',
        'dark-blue': '#00334e',
        'green': '#02874D',
        'red': '#90040B',
        'yellow': '#E98300',
        'white': '#f9fcff',
        'black': '#00222d',
        'gray': '#c1c3c7',
    }

    static max_width = 800;

    constructor() {}
}