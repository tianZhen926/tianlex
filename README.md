# Translator

一个基于 **Ollama + LangChain** 的本地 AI 英语词典插件。

选中文本后使用快捷键即可快速查询，支持编辑模式和阅读模式。

## Features

* 🤖 **本地 AI 翻译**：使用 Ollama 本地模型进行翻译
* 🔤 **英美音标**：提供 British / American IPA
* 📖 **词性识别**：自动识别 noun、verb、adjective 等词性
* 💬 **例句生成**：自动生成英文例句及中文翻译
* 🔊 **本地发音**：使用 macOS 系统语音播放英文
* ⚡ **翻译缓存**：查询过的内容自动缓存，重复查询无需再次调用模型
* ⭐ **收藏**：保存常用单词和短语
* 🕘 **历史记录**：查看最近查询内容
* 📋 **快速复制**：一键复制原文、翻译和音标
* ⚙️ **可配置**：支持选择 Ollama 模型、目标语言、语速和系统语音
* 🔒 **本地运行**：翻译和词典数据主要在本机处理，不依赖第三方翻译服务

## Requirements

本插件需要：

* Obsidian Desktop
* Ollama
* 一个本地 Ollama 模型

例如：

```bash
ollama run ali6parmak/hy-mt1.5:1.8b
```

安装插件后，在 Obsidian 设置中选择对应的 Ollama 模型。

## Usage

选中英文文本后，通过插件设置的快捷键即可打开词典窗口。

支持：

* 编辑模式
* 阅读模式
* 单词
* 短语
* 英文句子

## Privacy

Translator 使用本地 Ollama 模型进行 AI 处理，不需要第三方翻译 API Key。

查询缓存、历史记录和收藏内容保存在本地 Obsidian 插件目录中。
