import {
    MarkdownView,
    Modal,
    Notice,
    Plugin,
} from 'obsidian';

import {
    TranslatorSettingTab,
    TranslatorSettings,
    DictionaryResult,
    DEFAULT_SETTINGS,
    HistoryItem,
} from './settings';

import {
    loadStoredData,
    saveFavorites,
} from './storage';

import {
    translateText,
} from './translator';


export default class TianLexPlugin extends Plugin {

    settings!: TranslatorSettings;

    cache: Record<string, DictionaryResult> = {};

    history: HistoryItem[] = [];

    favorites: Record<string, DictionaryResult> = {};


    // ================================
    // 加载设置
    // ================================

    async loadSettings() {

        const saved =
            await this.loadData();

        this.settings =
            Object.assign(
                {},
                DEFAULT_SETTINGS,
                saved ?? {},
            );
    }


    // ================================
    // 保存设置
    // ================================

    async saveSettings() {

        await this.saveData(
            this.settings,
        );
    }


    // ================================
    // 加载缓存 / 历史 / 收藏
    // ================================

    async loadPluginData() {

        const data =
            await loadStoredData(this);

        this.cache =
            data.cache;

        this.history =
            data.history;

        this.favorites =
            data.favorites;
    }


    // ================================
    // 插件加载
    // ================================

    async onload() {

        await this.loadSettings();

        await this.loadPluginData();

        // ================================
        // 设置页面
        // ================================

        this.addSettingTab(
            new TranslatorSettingTab(
                this.app,
                this,
            ),
        );


        // ================================
        // 翻译
        // ================================

        this.addCommand({

            id: 'translate-selection',

            name: '翻译选中文本',

            callback: async () => {

                let text = '';


                const view =
                    this.app.workspace
                        .getActiveViewOfType(
                            MarkdownView,
                        );


                if (!view) {

                    new Notice(
                        '当前没有打开 Markdown 笔记',
                    );

                    return;
                }


                // ============================
                // 编辑模式
                // ============================

                if (
                    view.getMode() ===
                    'source'
                ) {

                    text =
                        view.editor
                            .getSelection()
                            .trim();

                }


                // ============================
                // 阅读模式
                // ============================

                else {

                    const selection =
                        window.getSelection();

                    text =
                        selection
                            ?.toString()
                            .trim() ?? '';
                }


                if (!text) {

                    new Notice(
                        '请先选择要翻译的文本',
                    );

                    return;
                }


                try {

                    new Notice(
                        '正在查询...',
                    );


                    const result =
                        await translateText(
                            this,
                            text,
                        );




                    const modal =
                        new TranslationModal(
                            this.app,
                            text,
                            result,
                            this,
                        );


                    modal.open();

                } catch (error) {

                    console.error(
                        '翻译失败:',
                        error,
                    );


                    new Notice(
                        error instanceof Error
                            ? error.message
                            : '翻译失败',
                    );
                }
            },
        });


        // ================================
        // 历史记录
        // ================================

        this.addCommand({

            id:
                'open-translation-history',

            name:
                '打开翻译历史',

            callback: () => {

                new HistoryModal(
                    this.app,
                    this,
                ).open();
            },
        });


        // ================================
        // 收藏夹
        // ================================

        this.addCommand({

            id:
                'open-translation-favorites',

            name:
                '打开收藏夹',

            callback: () => {

                new FavoritesModal(
                    this.app,
                    this,
                ).open();
            },
        });
    }


    // ================================
    // 卸载
    // ================================

    onunload() {

        if (
            typeof speechSynthesis !==
            'undefined'
        ) {

            speechSynthesis.cancel();
        }

    }
}


/* ==================================================
   翻译弹窗
================================================== */

class TranslationModal extends Modal {

    original: string;

    result: DictionaryResult;

    plugin: TianLexPlugin;

    isFavorite = false;


    constructor(
        app: any,
        original: string,
        result: DictionaryResult,
        plugin: TianLexPlugin,
    ) {

        super(app);

        this.original =
            original;

        this.result =
            result;

        this.plugin =
            plugin;
    }


    onOpen() {

        const {
            contentEl,
        } = this;


        contentEl.empty();


        // ================================
        // 外层
        // ================================

        const container =
            contentEl.createDiv({
                cls:
                    'translator-modal',
            });


        // ================================
        // 原文
        // ================================

        const word =
            container.createDiv({
                cls:
                    'translator-word',
            });


        word.createSpan({
            text:
                '原文：',
            cls:
                'translator-label',
        });


        word.createSpan({
            text:
                this.original,
        });


        this.createCopyIcon(
            word,
            this.original,
            '复制原文',
        );


        // ================================
        // 收藏
        // ================================

        const favoriteButton =
            word.createEl(
                'button',
                {
                    cls:
                        'translator-favorite',
                    text:
                        '☆',
                },
            );


        this.updateFavoriteState(
            favoriteButton,
        );


        favoriteButton.onclick =
            async () => {

            await this.toggleFavorite();

            this.updateFavoriteState(
                favoriteButton,
            );
        };


        // ================================
        // 英美音标
        // ================================

        const pronunciation =
            container.createDiv({
                cls:
                    'translator-pronunciation',
            });


        // ================================
        // 英音
        // ================================

        const uk =
            pronunciation.createDiv({
                cls:
                    'translator-pronunciation-row',
            });


        uk.createSpan({
            text:
                '英',
            cls:
                'translator-region',
        });


        uk.createSpan({
            text:
                this.result.ukIpa ||
                '暂无',
            cls:
                'translator-ipa',
        });


        const ukPlay =
            uk.createEl(
                'button',
                {
                    text:
                        '🔊',
                    cls:
                        'translator-icon-button',
                    attr: {
                        'aria-label':
                            '播放英音',
                    },
                },
            );


        ukPlay.onclick =
            () => {

            this.speak(
                this.original,
            );
        };


        this.createCopyIcon(
            uk,
            this.result.ukIpa || '',
            '复制英式音标',
        );


        // ================================
        // 美音
        // ================================

        const us =
            pronunciation.createDiv({
                cls:
                    'translator-pronunciation-row',
            });


        us.createSpan({
            text:
                '美',
            cls:
                'translator-region',
        });


        us.createSpan({
            text:
                this.result.usIpa ||
                '暂无',
            cls:
                'translator-ipa',
        });


        const usPlay =
            us.createEl(
                'button',
                {
                    text:
                        '🔊',
                    cls:
                        'translator-icon-button',
                    attr: {
                        'aria-label':
                            '播放美音',
                    },
                },
            );


        usPlay.onclick =
            () => {

            this.speak(
                this.original,
            );
        };


        this.createCopyIcon(
            us,
            this.result.usIpa || '',
            '复制美式音标',
        );


        // ================================
        // 词性
        // ================================

        const partOfSpeech =
            container.createDiv({
                cls:
                    'translator-pos',
            });


        partOfSpeech.setText(
            this.result.partOfSpeech ||
            '词性未知',
        );


        // ================================
        // 分割线
        // ================================

        container.createDiv({
            cls:
                'translator-divider',
        });


        // ================================
        // 中文翻译
        // ================================

        const translation =
            container.createDiv({
                cls:
                    'translator-translation',
            });


        translation.createSpan({
            text:
                '中文：',
            cls:
                'translator-label',
        });


        translation.createSpan({
            text:
                this.result.translation,
        });


        this.createCopyIcon(
            translation,
            this.result.translation,
            '复制翻译',
        );


        // ================================
        // 例句
        // ================================

        if (
            this.result.examples.length
        ) {

            container.createDiv({
                cls:
                    'translator-divider',
            });


            const title =
                container.createEl(
                    'h3',
                    {
                        text:
                            '例句',
                    },
                );


            title.addClass(
                'translator-section-title',
            );


            for (
                const example
                of this.result.examples
            ) {

                const exampleBox =
                    container.createDiv({
                        cls:
                            'translator-example',
                    });


                const english =
                    exampleBox.createDiv({
                        cls:
                            'translator-example-en',
                    });


                english.createSpan({
                    text:
                        example.english,
                });


                const play =
                    english.createEl(
                        'button',
                        {
                            text:
                                '🔊',
                            cls:
                                'translator-example-play',
                        },
                    );


                play.onclick =
                    () => {

                    this.speak(
                        example.english,
                    );
                };


                exampleBox.createDiv({
                    text:
                        example.chinese,
                    cls:
                        'translator-example-cn',
                });
            }
        }
    }


    // ================================
    // 收藏
    // ================================

    async toggleFavorite() {

        const key =
            this.original
                .trim()
                .toLowerCase();


        if (
            this.plugin.favorites[key]
        ) {

            delete this.plugin
                .favorites[key];

            this.isFavorite =
                false;

        } else {

            this.plugin
                .favorites[key] =
                this.result;

            this.isFavorite =
                true;
        }


        await saveFavorites(
            this.plugin,
            this.plugin.favorites,
        );
    }


    private updateFavoriteState(
        button: HTMLButtonElement,
    ) {

        const key =
            this.original
                .trim()
                .toLowerCase();


        this.isFavorite =
            !!this.plugin
                .favorites[key];


        button.setText(
            this.isFavorite
                ? '⭐'
                : '☆',
        );
    }


    // ================================
    // 复制小图标
    // ================================

    private createCopyIcon(
        parent: HTMLElement,
        value: string,
        label: string,
    ) {

        const button =
            parent.createEl(
                'button',
                {
                    text:
                        '⧉',
                    cls:
                        'translator-copy-icon',
                    attr: {
                        'aria-label':
                            label,
                        title:
                            label,
                    },
                },
            );


        button.onclick =
            async (event) => {

            event.stopPropagation();


            if (!value) {
                return;
            }


            await navigator.clipboard
                .writeText(value);


            new Notice(
                '已复制',
            );
        };
    }


    // ================================
    // 语音
    // ================================

    private async speak(
		text: string,
	) {

		if (
			typeof speechSynthesis ===
			'undefined'
		) {
			new Notice(
				'当前环境不支持语音',
			);

			return;
		}

		speechSynthesis.cancel();


		// ================================
		// 等待系统语音加载
		// ================================

		let voices =
			speechSynthesis.getVoices();

		if (!voices.length) {

			voices =
				await new Promise<
					SpeechSynthesisVoice[]
				>((resolve) => {

					const handler = () => {

						speechSynthesis
							.removeEventListener(
								'voiceschanged',
								handler,
							);

						resolve(
							speechSynthesis.getVoices(),
						);
					};

					speechSynthesis
						.addEventListener(
							'voiceschanged',
							handler,
						);
				});
		}


		// ================================
		// 创建语音
		// ================================

		const utterance =
			new SpeechSynthesisUtterance(
				text,
			);

		utterance.rate =
			this.plugin.settings.speechRate;

		utterance.pitch = 1;

		utterance.volume = 1;


		// ================================
		// 强制寻找 Samantha
		// ================================

		const samantha =
			voices.find(
				(voice) =>
					voice.name === 'Samantha' &&
					voice.lang === 'en-US',
			);


		if (samantha) {

			utterance.voice =
				samantha;

			utterance.lang =
				'en-US';



		} else {

			const fallback =
				voices.find(
					(voice) =>
						voice.lang === 'en-US',
				);

			if (fallback) {

				utterance.voice =
					fallback;

				utterance.lang =
					'en-US';

				console.warn(
					'没有找到 Samantha，使用:',
					fallback.name,
					fallback.lang,
				);

			} else {

				utterance.lang =
					'en-US';

				console.warn(
					'没有找到 Samantha 或 en-US 语音',
				);
			}
		}


		speechSynthesis.speak(
			utterance,
		);
	}


    onClose() {

        if (
            typeof speechSynthesis !==
            'undefined'
        ) {

            speechSynthesis.cancel();
        }

        this.contentEl.empty();
    }
}


/* ==================================================
   历史记录
================================================== */

class HistoryModal extends Modal {

    plugin: TianLexPlugin;


    constructor(
        app: any,
        plugin: TianLexPlugin,
    ) {

        super(app);

        this.plugin =
            plugin;
    }


    onOpen() {

        const {
            contentEl,
        } = this;


        contentEl.empty();


        contentEl.createEl(
            'h2',
            {
                text:
                    '查询历史',
            },
        );


        const history =
            this.plugin.history;


        if (!history.length) {

            contentEl.createEl(
                'p',
                {
                    text:
                        '暂无历史记录',
                },
            );

            return;
        }


        for (
            const item of history
        ) {

            const row =
                contentEl.createDiv({
                    cls:
                        'translator-history-item',
                });


            row.createEl(
                'strong',
                {
                    text:
                        item.text,
                },
            );


            row.createDiv({
                text:
                    item.result.translation,
            });


            row.onclick =
                () => {

                this.close();

                new TranslationModal(
                    this.app,
                    item.text,
                    item.result,
                    this.plugin,
                ).open();
            };
        }
    }


    onClose() {

        this.contentEl.empty();
    }
}


/* ==================================================
   收藏夹
================================================== */

class FavoritesModal extends Modal {

    plugin: TianLexPlugin;


    constructor(
        app: any,
        plugin: TianLexPlugin,
    ) {

        super(app);

        this.plugin =
            plugin;
    }


    onOpen() {

        const {
            contentEl,
        } = this;


        contentEl.empty();


        contentEl.createEl(
            'h2',
            {
                text:
                    '我的收藏',
            },
        );


        const favorites =
            this.plugin.favorites;


        const words =
            Object.keys(
                favorites,
            );


        if (!words.length) {

            contentEl.createEl(
                'p',
                {
                    text:
                        '暂无收藏',
                },
            );

            return;
        }


        for (const word of words) {

    const result = favorites[word];

    if (!result) {
        continue;
    }

    const row =
        contentEl.createDiv({
            cls:
                'translator-history-item',
        });

    row.createEl(
        'strong',
        {
            text:
                `⭐ ${word}`,
        },
    );

    row.createDiv({
        text:
            result.translation,
    });

    row.onclick = () => {

        this.close();

        new TranslationModal(
            this.app,
            word,
            result,
            this.plugin,
        ).open();
    };
}
    }


    onClose() {

        this.contentEl.empty();
    }
}
