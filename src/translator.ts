import { ChatOllama } from '@langchain/ollama';
import { z } from 'zod';

import type TranslatorPlugin from './main';
import {
    saveCache,
    saveHistory,
} from './storage';
import type {
    DictionaryResult,
} from './settings';


const resultSchema = z.object({

    translation:
        z.string()
            .describe(
                '翻译结果',
            ),

    ukIpa:
        z.string()
            .describe(
                '英式英语 IPA 国际音标',
            ),

    usIpa:
        z.string()
            .describe(
                '美式英语 IPA 国际音标',
            ),

    partOfSpeech:
        z.string()
            .describe(
                '英文词性，例如 noun、verb、adjective',
            ),

    examples:
        z.array(
            z.object({

                english:
                    z.string(),

                chinese:
                    z.string(),

            }),
        )
        .max(3)
        .describe(
            '最多三个实用例句',
        ),
});
function cleanIpa(ipa: string): string {
    const value = ipa
        .trim()
        .replace(/^```(?:text)?/i, '')
        .replace(/```$/i, '')
        .replace(/[*_`]/g, '')
        .trim();

    if (value.includes('�')) {
        return '暂无音标';
    }

    return value;
}

export async function translateText(
    plugin: TranslatorPlugin,
    text: string,
): Promise<DictionaryResult> {

    const start = Date.now();

    const input =
        text.trim();

    if (!input) {
        throw new Error(
            '翻译文本不能为空',
        );
    }


    // ================================
    // 缓存
    // ================================

    const cacheKey =
        `${plugin.settings.targetLanguage}::${input.toLowerCase()}`;


    const cached =
    	plugin.cache[cacheKey];


    if (cached) {

        console.log(
            '命中翻译缓存:',
            input,
        );

        return cached;
    }


    // ================================
    // Ollama
    // ================================

    const model =
        new ChatOllama({
            model:
                plugin.settings.model,

            temperature:
                0,

            baseUrl:
                'http://localhost:11434',
        });


    const structuredModel =
        model.withStructuredOutput(
            resultSchema,
        );


    const result =
        await structuredModel.invoke([

            {
                role: 'system',

                content:
`You are a professional English dictionary assistant.

Analyze the user's English input.

Target language:
${plugin.settings.targetLanguage}

Return:
1. A natural translation.
2. British English IPA.
3. American English IPA.
4. Part of speech.
5. Up to 3 useful example sentences.

Rules:
- For a single word, give the common pronunciation.
- For a phrase, give the pronunciation of the phrase.
- For a sentence, provide the pronunciation of the sentence.
- Use standard IPA only.
- Return IPA enclosed in / /.
- Do not use Markdown.
- Do not use Chinese characters inside IPA.
- Do not output replacement characters such as �.
- If British and American pronunciation are the same, return the same IPA.
- Examples must be useful and natural.
- Chinese translations should sound natural rather than literal.`,
            },

            {
                role: 'user',

                content:
                    input,
            },
        ]);


    console.log(
        'LangChain Ollama耗时:',
        Date.now() - start,
        'ms',
    );


    console.log(
        '结构化结果:',
        result,
    );


    const dictionaryResult: DictionaryResult = {

        translation:
            result.translation.trim(),

        ukIpa:
            cleanIpa(result.ukIpa),

        usIpa:
            cleanIpa(result.usIpa),

        partOfSpeech:
            result.partOfSpeech.trim(),

        examples:
            result.examples.map(
                (example) => ({
                    english:
                        example.english.trim(),

                    chinese:
                        example.chinese.trim(),
                }),
            ),
    };


    // ================================
    // 保存缓存
    // ================================

    plugin.cache[cacheKey] =
    dictionaryResult;

	await saveCache(
		plugin,
		plugin.cache,
	);


    // ================================
    // 保存历史
    // ================================

    plugin.history.unshift({
			text: input,
			result: dictionaryResult,
			timestamp: Date.now(),
		});

		plugin.history =
			plugin.history.slice(0, 100);

		await saveHistory(
			plugin,
			plugin.history,
		);


    await plugin.saveSettings();


    return dictionaryResult;
}
