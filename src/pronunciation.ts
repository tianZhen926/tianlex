import {
    Plugin,
    requestUrl,
} from 'obsidian';

export interface PronunciationResult {
    word: string;
    phonetic: string;
    audioUrl?: string;
}

const CACHE_PATH =
    'data/phonetic-cache.json';

let plugin: Plugin | null = null;


export function setPronunciationPlugin(
    instance: Plugin,
) {

    plugin = instance;
}


async function loadCache():
    Promise<Record<string, string>> {

    if (!plugin) {
        return {};
    }

    try {

        const exists =
            await plugin.app.vault.adapter.exists(
                CACHE_PATH,
            );

        if (!exists) {
            return {};
        }

        const content =
            await plugin.app.vault.adapter.read(
                CACHE_PATH,
            );

        if (!content.trim()) {
            return {};
        }

        return JSON.parse(content);

    } catch (error) {

        console.error(
            '读取音标缓存失败:',
            error,
        );

        return {};
    }
}


async function saveCache(
    cache: Record<string, string>,
): Promise<void> {

    if (!plugin) {
        return;
    }

    try {

        await plugin.app.vault.adapter.write(
            CACHE_PATH,
            JSON.stringify(
                cache,
                null,
                2,
            ),
        );

    } catch (error) {

        console.error(
            '保存音标缓存失败:',
            error,
        );
    }
}


async function fetchFromDictionaryApi(
    word: string,
): Promise<string> {

    const url =
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;


    const response =
        await Promise.race([

            requestUrl({
                url,
                method: 'GET',
            }),

            new Promise<never>(
                (_, reject) => {

                    setTimeout(
                        () => {

                            reject(
                                new Error(
                                    '请求音标超时',
                                ),
                            );

                        },
                        2000,
                    );
                },
            ),
        ]);


    const data =
        response.json;


    if (
        !Array.isArray(data) ||
        !data[0]
    ) {

        throw new Error(
            '没有找到这个单词',
        );
    }


    const entry =
        data[0];


    if (entry.phonetic) {

        return entry.phonetic;
    }


    if (
        Array.isArray(
            entry.phonetics,
        )
    ) {

        for (
            const item of entry.phonetics
        ) {

            if (item?.text) {

                return item.text;
            }
        }
    }


    throw new Error(
        '没有找到音标',
    );
}


export async function getPronunciation(
    word: string,
): Promise<PronunciationResult> {

    const normalizedWord =
        word
            .trim()
            .toLowerCase();


    if (!normalizedWord) {

        return {
            word,
            phonetic: '暂无音标',
        };
    }


    // ================================
    // 1. 本地缓存
    // ================================

    const cache =
        await loadCache();


    if (
        cache[normalizedWord]
    ) {

        console.log(
            '音标来自本地缓存:',
            normalizedWord,
        );

        return {
            word,
            phonetic:
                cache[normalizedWord],
        };
    }


    // ================================
    // 2. API
    // ================================

    try {

        console.log(
            '请求 Dictionary API:',
            normalizedWord,
        );


        const phonetic =
            await fetchFromDictionaryApi(
                normalizedWord,
            );


        // ============================
        // 3. 写入缓存
        // ============================

        cache[normalizedWord] =
            phonetic;


        await saveCache(
            cache,
        );


        return {
            word,
            phonetic,
        };

    } catch (error) {

        console.error(
            '获取音标失败:',
            error,
        );


        return {
            word,
            phonetic: '暂无音标',
        };
    }
}
