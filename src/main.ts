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

	isTranslating = false;

	translationAbortController: AbortController | null = null;


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

		if (
			typeof speechSynthesis !==
			'undefined'
		) {
			speechSynthesis.getVoices();

			speechSynthesis.addEventListener(
				'voiceschanged',
				() => {
					speechSynthesis.getVoices();
				},
				{
					once: true,
				},
			);
		}
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


                if (this.isTranslating) {
					new Notice('正在查询，请稍候');
					return;
				}

				this.isTranslating = true;
				this.translationAbortController =
					new AbortController();

				const controller =
					this.translationAbortController;

				try {

					const notice =
						new Notice(
							'正在查询...',
							0,
						);

					const cancelButton =
						notice.noticeEl.createEl(
							'button',
							{
								text: '取消翻译',
								cls: 'tianlex-cancel-button',
							},
						);

					cancelButton.onclick = () => {

						controller.abort();

						notice.hide();

						new Notice(
							'已取消翻译',
						);
					};

					const result =
						await translateText(
							this,
							text,
							controller.signal,
						);

					notice.hide();

					const modal =
						new TranslationModal(
							this.app,
							text,
							result,
							this,
						);

					modal.open();

				} catch (error) {

					if (
						error instanceof DOMException &&
						error.name === 'AbortError'
					) {
						return;
					}

					console.error(
						'翻译失败:',
						error,
					);

					new Notice(
						error instanceof Error
							? error.message
							: '翻译失败',
					);

				} finally {

					this.isTranslating = false;

					this.translationAbortController =
						null;
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
			// ================================
			// 语音设置
			// ================================

			const speechSettings =
				container.createDiv({
					cls: 'translator-speech-settings',
				});

			speechSettings.createSpan({
				text: '语速',
				cls: 'translator-speech-label',
			});

			const rateSelect =
				speechSettings.createEl('select', {
					cls: 'translator-speech-select',
				});

			const rateOptions = [
				{ value: '0.6', label: '0.6x' },
				{ value: '0.7', label: '0.7x' },
				{ value: '0.8', label: '0.8x' },
				{ value: '0.9', label: '0.9x' },
				{ value: '1.0', label: '1.0x' },
				{ value: '1.1', label: '1.1x' },
				{ value: '1.2', label: '1.2x' },
				{ value: '1.3', label: '1.3x' },
			];

			for (const option of rateOptions) {
				rateSelect.createEl('option', {
					value: option.value,
					text: option.label,
				});
			}

			rateSelect.value =
				String(this.plugin.settings.speechRate);

			rateSelect.onchange = async () => {
				this.plugin.settings.speechRate =
					Number(rateSelect.value);

				await this.plugin.saveSettings();
			};


			speechSettings.createSpan({
				text: '音色',
				cls:
					'translator-speech-label translator-speech-voice-label',
			});

			const voiceSelect =
				speechSettings.createEl('select', {
					cls: 'translator-speech-select',
				});

			const voices =
				typeof speechSynthesis !== 'undefined'
					? speechSynthesis.getVoices()
					: [];

			const englishVoices =
				voices.filter(
					voice =>
						voice.lang.startsWith('en'),
				);

			const voiceNames =
				[...new Set(
					englishVoices.map(
						voice => voice.name,
					),
				)];

			if (!voiceNames.includes('Samantha')) {
				voiceNames.unshift('Samantha');
			}

			for (const voiceName of voiceNames) {
				voiceSelect.createEl('option', {
					value: voiceName,
					text: voiceName,
				});
			}

			voiceSelect.value =
				this.plugin.settings.voiceName ||
				'Samantha';

			voiceSelect.onchange = async () => {
				this.plugin.settings.voiceName =
					voiceSelect.value;

				await this.plugin.saveSettings();
			};
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

    private speak(
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

		const voices =
			speechSynthesis.getVoices();


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

		utterance.lang = 'en-US';


		// ================================
		// 优先使用 Samantha
		// ================================

		const selectedVoice =
			voices.find(
				(voice) =>
					voice.name ===
					this.plugin.settings.voiceName,
			);

		if (selectedVoice) {

			utterance.voice =
				selectedVoice;

			utterance.lang =
				selectedVoice.lang;

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
					fallback.lang;

			} else {

				utterance.lang =
					'en-US';
			}
		}





		// ================================
		// 播放错误
		// ================================

		utterance.onerror =
			(event) => {

				console.error(
					'TianLex 语音播放失败:',
					event.error,
				);
			};


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
