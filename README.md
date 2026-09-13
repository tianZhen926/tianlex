# TianLex

A local AI English dictionary powered by Ollama and LangChain.

Select English text in Obsidian to quickly view its Chinese translation, British and American IPA, part of speech, example sentences, and pronunciation.

## Features

- Local AI translation with Ollama
- British and American IPA
- Part-of-speech detection
- AI-generated example sentences
- macOS system pronunciation
- Translation cache
- History
- Favorites
- Copy translation and IPA
- Support for editing mode and reading mode
- Configurable Ollama model, target language, speech rate, and voice

## Requirements

- Obsidian Desktop
- Ollama
- A local Ollama model

For example:

```bash
ollama pull ali6parmak/hy-mt1.5:1.8b
```
Usage

Select English text and run the TianLex translation command.

Privacy

TianLex uses local Ollama models for AI processing and does not require a third-party translation API key.
Translation cache, history, and favorites are stored locally.
