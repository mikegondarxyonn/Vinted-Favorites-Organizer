import {
    STORAGE_KEY
} from '../constants.js';


export const listingCache =
    new Map();


export function persistListingCacheToStorage() {

    try {

        const entries =
            Array.from(
                listingCache.entries()
            );


        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(entries)
        );


        return true;

    } catch (error) {

        console.error(
            'Erro ao guardar cache:',
            error
        );


        return false;

    }
}


export function restoreListingCacheFromStorage() {

    const savedData =
        localStorage.getItem(
            STORAGE_KEY
        );


    if (!savedData) {

        console.log(
            'Nenhuma cache guardada encontrada.'
        );

        return;
    }


    try {

        const entries =
            JSON.parse(
                savedData
            );


        if (!Array.isArray(entries)) {

            throw new Error(
                'Formato de cache inválido.'
            );

        }


        listingCache.clear();


        entries.forEach(
    function (entry) {

        if (
            !Array.isArray(entry) ||
            entry.length !== 2
        ) {

            return;

        }


        const id =
            String(
                entry[0]
            );


        const record =
            entry[1];


        if (!record) {

            return;

        }


        listingCache.set(
            id,
            record
        );

    }
);


console.log(
    `Cache restaurada: ${listingCache.size} anúncios.`
);


        

    } catch (error) {

        console.error(
            'Erro ao restaurar cache:',
            error
        );

    }
}
