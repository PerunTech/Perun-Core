import { axios } from '../../../client';

export const TABLE_NAME = 'SVAROG_LABELS';
export const FORM_ID = 'SVAROG_LABELS_FORM';
export const GRID_ID = 'SVAROG_LABELS_GRID';

const getLocaleLabel = (() => {
    let displayNames;
    try {
        displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
    } catch {
        // No Intl.DisplayNames: the raw code.
    }
    return (id) => {
        if (!displayNames) return id;
        try {
            return displayNames.of(id.replace('_', '-')) || id;
        } catch {
            return id;
        }
    };
})();

export const fetchLocales = () =>
    axios.get(`${window.server}/WsConf/params/get/sys/ENV_LOCALES`)
        .then(res => {
            const parsed = JSON.parse(res?.data?.VALUE ?? '[]');
            const ids = Array.isArray(parsed) && parsed.length > 0 ? parsed : ['en_US'];
            return ids.map(id => ({ id, label: getLocaleLabel(id) }));
        });

export const generateExport = async (svSession, locale, signal) => {
    const url = `${window.server}/ReactElements/getTableWithFilter/${svSession}/${TABLE_NAME}/LOCALE_ID/${locale}/0/DESC`;
    const res = await axios.get(url, { signal });
    const rows = res?.data || [];
    let output = `# ${locale}\n`;
    rows.forEach(row => {
        const key = row[`FIELD.${TABLE_NAME}.LABEL_CODE`] || '';
        const value = row[`${TABLE_NAME}.LABEL_TEXT`] || '';
        if (key) output += `${key}=${value}\n`;
    });
    return output;
};

export const downloadPropertiesFile = (text, locale) => {
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${locale}Labels.properties`;
    a.click();
    URL.revokeObjectURL(url);
};
