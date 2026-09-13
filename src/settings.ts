import {
    PluginSettingTab,
    Setting,
    requestUrl,
} from 'obsidian';
import type TianLexPlugin from './main';
import {saveCache, saveFavorites, saveHistory} from "./storage";

export interface ExampleSentence {
    english: string;
    chinese: string;
}

export interface DictionaryResult {
    translation: string;
    ukIpa: string;
    usIpa: string;
    partOfSpeech: string;
    examples: ExampleSentence[];
}

export interface HistoryItem {
    text: string;
    result: DictionaryResult;
    timestamp: number;
}

export interface TranslatorSettings {
    model: string;
    targetLanguage: string;
    speechRate: number;
    voiceName: string;
}

export const DEFAULT_SETTINGS: TranslatorSettings = {
    model: 'qwen2.5:7b',

    targetLanguage: '中文',

    speechRate: 0.9,

    voiceName: 'Samantha',

};


export class TranslatorSettingTab
    extends PluginSettingTab {

    plugin: TianLexPlugin;

    constructor(
        app: any,
        plugin: TianLexPlugin,
    ) {
        super(app, plugin);

        this.plugin = plugin;
    }


    display(): void {

        const {
            containerEl,
        } = this;

        containerEl.empty();


        // ================================
        // 标题
        // ================================

        new Setting(containerEl)
			.setName('TianLex')
			.setHeading();


        containerEl.createEl(
            'p',
            {
                text:
                    '本地 Ollama AI 英语词典',
                cls:
                    'translator-setting-desc',
            },
        );


        // ================================
        // Ollama 模型
        // ================================

        new Setting(containerEl)
            .setName('翻译模型')
            .setDesc(
                '从本机 Ollama 自动读取已安装模型',
            )
            .addDropdown(
                (dropdown) => {

                    dropdown.setValue(
                        this.plugin.settings.model,
                    );

                    this.loadModels(
                        dropdown,
                    );

                    dropdown.onChange(
                        async (value) => {

                            this.plugin.settings.model =
                                value;

                            await this.plugin.saveSettings();
                        },
                    );
                },
            );


        // ================================
        // 目标语言
        // ================================

        new Setting(containerEl)
            .setName('目标语言')
            .setDesc(
                'AI 翻译的目标语言',
            )
            .addDropdown(
                (dropdown) => {

                    const languages = [
                        '中文',
                        'English',
                        '日本語',
                        '한국어',
                    ];

                    for (
                        const language
                        of languages
                    ) {

                        dropdown.addOption(
                            language,
                            language,
                        );
                    }

                    dropdown.setValue(
                        this.plugin.settings
                            .targetLanguage,
                    );

                    dropdown.onChange(
                        async (value) => {

                            this.plugin.settings
                                .targetLanguage =
                                value;

                            await this.plugin
                                .saveSettings();
                        },
                    );
                },
            );


        // ================================
        // 语速
        // ================================

        new Setting(containerEl)
            .setName('语速')
            .setDesc(
                'macOS 语音播放速度',
            )
            .addDropdown(
                (dropdown) => {

                    const rates = [
                        0.6,
                        0.7,
                        0.8,
                        0.9,
                        1.0,
                        1.1,
                        1.2,
                    ];

                    for (
                        const rate of rates
                    ) {

                        dropdown.addOption(
                            String(rate),
                            `${rate.toFixed(1)}x`,
                        );
                    }

                    dropdown.setValue(
                        String(
                            this.plugin.settings
                                .speechRate,
                        ),
                    );

                    dropdown.onChange(
                        async (value) => {

                            this.plugin.settings
                                .speechRate =
                                Number(value);

                            await this.plugin
                                .saveSettings();
                        },
                    );
                },
            );


        // ================================
        // 系统声音
        // ================================

        new Setting(containerEl)
            .setName('语音')
            .setDesc(
                '选择 macOS 英语语音',
            )
            .addDropdown(
                (dropdown) => {

                    this.loadVoices(
                        dropdown,
                    );

                    dropdown.onChange(
                        async (value) => {

                            this.plugin.settings
                                .voiceName =
                                value;

                            await this.plugin
                                .saveSettings();
                        },
                    );
                },
            )
            .addButton(
                (button) => {

                    button
                        .setButtonText('刷新')
                        .onClick(
                            () => {

                                this.display();
                            },
                        );
                },
            );


        // ================================
        // 缓存
        // ================================

        new Setting(containerEl)
            .setName('翻译缓存')
            .setDesc(
                `当前缓存 ${Object.keys(
                    this.plugin.cache,
                ).length} 条`,
            )
            .addButton(
                (button) => {

                    button
                        .setButtonText(
                            '清空缓存',
                        )
                        .setWarning()
                        .onClick(async () => {

							this.plugin.cache = {};

							await saveCache(
								this.plugin,
								this.plugin.cache,
							);

							this.display();
						});
                },
            );


        // ================================
        // 历史记录
        // ================================

        new Setting(containerEl)
            .setName('查询历史')
            .setDesc(
                `共 ${
                    this.plugin.history.length
                } 条`,
            )
            .addButton(
                (button) => {

                    button
                        .setButtonText(
                            '清空历史',
                        )
                        .setWarning()
                        .onClick(async () => {

							this.plugin.history = [];

							await saveHistory(
								this.plugin,
								this.plugin.history,
							);

							this.display();
						});
                },
            );


        // ================================
        // 收藏
        // ================================

        new Setting(containerEl)
            .setName('收藏')
            .setDesc(
                `共 ${
                    Object.keys(
                        this.plugin
                            
                            .favorites,
                    ).length
                } 条`,
            )
            .addButton(
                (button) => {

                    button
                        .setButtonText(
                            '清空收藏',
                        )
                        .setWarning()
                        .onClick(async () => {

							this.plugin.favorites = {};

							await saveFavorites(
								this.plugin,
								this.plugin.favorites,
							);

							this.display();
						});
                },
            );
    }


    // ================================
    // 获取 Ollama 模型
    // ================================

    private async loadModels(
        dropdown: any,
    ) {

        try {

            const response =
                await requestUrl({
                    url:
                        'http://localhost:11434/api/tags',
                    method: 'GET',
                });

            const data =
                response.json;

            const models =
                data?.models ?? [];


            dropdown.selectEl.empty();


            for (
                const model of models
            ) {

                dropdown.addOption(
                    model.name,
                    model.name,
                );
            }


            if (
                models.some(
                    (model: any) =>
                        model.name ===
                        this.plugin
                            .settings
                            .model,
                )
            ) {

                dropdown.setValue(
                    this.plugin
                        .settings
                        .model,
                );

            } else if (
                models.length > 0
            ) {

                this.plugin.settings.model =
                    models[0].name;

                await this.plugin
                    .saveSettings();

                dropdown.setValue(
                    models[0].name,
                );
            }

        } catch (error) {

            console.error(
                '获取 Ollama 模型失败:',
                error,
            );

            dropdown.addOption(
                this.plugin.settings.model,
                this.plugin.settings.model,
            );
        }
    }


    // ================================
    // 获取系统语音
    // ================================

    private loadVoices(
        dropdown: any,
    ) {

        const load = () => {

            const voices =
                speechSynthesis
                    .getVoices()
                    .filter(
                        (voice) =>
                            voice.lang
                                .toLowerCase()
                                .startsWith('en'),
                    );


            dropdown.selectEl.empty();


            for (
                const voice
                of voices
            ) {

                dropdown.addOption(
                    voice.name,
                    `${voice.name} (${voice.lang})`,
                );
            }


            const current =
                voices.find(
                    (voice) =>
                        voice.name ===
                        this.plugin
                            .settings
                            .voiceName,
                );


            if (current) {

                dropdown.setValue(
                    current.name,
                );

            } else if (
                voices.length > 0
            ) {

                const samantha =
                    voices.find(
                        (voice) =>
                            voice.name ===
                            'Samantha',
                    );


                const selected =
					samantha ?? voices[0];

				if (!selected) {
					return;
				}

				this.plugin.settings.voiceName =
					selected.name;

				dropdown.setValue(
					selected.name,
				);

				void this.plugin.saveSettings();

                void this.plugin
                    .saveSettings();
            }
        };


        load();


        // Safari / Electron 语音加载完成
        speechSynthesis.addEventListener(
            'voiceschanged',
            load,
            {
                once: true,
            },
        );
    }
}
