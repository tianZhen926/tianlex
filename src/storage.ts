import type { Plugin } from 'obsidian';

import type {
    DictionaryResult,
    HistoryItem,
} from './settings';


export interface StoredData {
    cache: Record<string, DictionaryResult>;
    history: HistoryItem[];
    favorites: Record<string, DictionaryResult>;
}


/**
 * 获取插件数据文件路径
 */
function getPath(
    plugin: Plugin,
    fileName: string,
): string {

    return `${plugin.manifest.dir}/${fileName}`;
}


/**
 * 读取 JSON 文件
 */
async function readJson<T>(
    plugin: Plugin,
    fileName: string,
    defaultValue: T,
): Promise<T> {

    const adapter =
        plugin.app.vault.adapter;

    const path =
        getPath(plugin, fileName);

    try {

        const exists =
            await adapter.exists(path);

        if (!exists) {
            return defaultValue;
        }

        const content =
            await adapter.read(path);

        if (!content.trim()) {
            return defaultValue;
        }

        return JSON.parse(content) as T;

    } catch (error) {

        console.error(
            `读取 ${fileName} 失败:`,
            error,
        );

        return defaultValue;
    }
}


/**
 * 写入 JSON 文件
 */
async function writeJson<T>(
    plugin: Plugin,
    fileName: string,
    data: T,
): Promise<void> {

    const adapter =
        plugin.app.vault.adapter;

    const path =
        getPath(plugin, fileName);

    await adapter.write(
        path,
        JSON.stringify(
            data,
            null,
            2,
        ),
    );
}


/**
 * 加载缓存
 */
export async function loadCache(
    plugin: Plugin,
): Promise<Record<string, DictionaryResult>> {

    return readJson(
        plugin,
        'cache.json',
        {},
    );
}


/**
 * 保存缓存
 */
export async function saveCache(
    plugin: Plugin,
    cache: Record<string, DictionaryResult>,
): Promise<void> {

    await writeJson(
        plugin,
        'cache.json',
        cache,
    );
}


/**
 * 加载历史
 */
export async function loadHistory(
    plugin: Plugin,
): Promise<HistoryItem[]> {

    return readJson(
        plugin,
        'history.json',
        [],
    );
}


/**
 * 保存历史
 */
export async function saveHistory(
    plugin: Plugin,
    history: HistoryItem[],
): Promise<void> {

    await writeJson(
        plugin,
        'history.json',
        history,
    );
}


/**
 * 加载收藏
 */
export async function loadFavorites(
    plugin: Plugin,
): Promise<Record<string, DictionaryResult>> {

    return readJson(
        plugin,
        'favorites.json',
        {},
    );
}


/**
 * 保存收藏
 */
export async function saveFavorites(
    plugin: Plugin,
    favorites: Record<string, DictionaryResult>,
): Promise<void> {

    await writeJson(
        plugin,
        'favorites.json',
        favorites,
    );
}


/**
 * 一次加载所有数据
 */
export async function loadStoredData(
    plugin: Plugin,
): Promise<StoredData> {

    const [
        cache,
        history,
        favorites,
    ] = await Promise.all([
        loadCache(plugin),
        loadHistory(plugin),
        loadFavorites(plugin),
    ]);

    return {
        cache,
        history,
        favorites,
    };
}
