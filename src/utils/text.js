export function normalizeFolderName(name) {

    return String(
        name || ''
    )
        .trim()
        .replace(
            /\s+/g,
            ' '
        );
}


export function getNormalizedFolderName(name) {

    return normalizeFolderName(
        name
    ).toLocaleLowerCase(
        'pt-PT'
    );
}


export function normalizeText(text) {

    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(
            /[\u0300-\u036f]/g,
            ''
        )
        .trim();
}
