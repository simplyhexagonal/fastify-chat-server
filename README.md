# Fastify Chat Server 💬

Fastify Chat Server provides a simple yet blazing fast file browser UI for viewing and downloading
local files within the working directory where you run it.

![](https://raw.githubusercontent.com/simplyhexagonal/fastify-chat-server/main/demo.gif)

Built using:

- [Fastify](https://www.fastify.io/) - HTTP Server
- [Vue JS](https://vuejs.org/) - UI Markup
- [Tailwind CSS](https://tailwindcss.com/) - UI Styles
- [Axios](https://axios-http.com/) - Client HTTP Requests
- [Remix Icon](https://remixicon.com/) - Icons

## Open source notice

This project is part of the [Open Collective](https://opencollective.com/simplyhexagonal) project [Simply Hexagonal](https://simplyhexagonal.org)
and is open to updates by its users, we ensure that PRs are relevant to the community.
In other words, if you find a bug or want a new feature, please help us by becoming one of the
[contributors](#contributors-) ✌️ ! See the [contributing section](#contributing).

## Like this module? ❤

Please consider:

- [Buying me a coffee](https://www.buymeacoffee.com/jeanlescure) ☕
- Supporting me on [Patreon](https://www.patreon.com/jeanlescure) 🏆
- Starring this repo on [Github](https://github.com/simplyhexagonal/fastify-chat-server) 🌟

## Features

- Lightweight 🪶
- Self-contained 📦
- Simple and fast UI ✨
- Light and Dark theme 🌗
- Ability to secure chat rooms with password 🔒
- Ability to store chat history 💾
- GIF support through [Giphy API](https://developers.giphy.com/docs/api/#quick-start-guide) 🎞️
- Mobile friendly UI 📱

## Usage

Using NPX:

```
npx @simplyhexagonal/fastify-chat-server
```

Installing globally:

```
npm i --global @simplyhexagonal/fastify-chat-server
```

```
fastify-chat-server
```

Optionally you can set other options using CLI arguments:

```sh
Options:
      --version        Show version number                             [boolean]
      --port           Port number to listen on         [number] [default: 3000]
      --host           Host name to bind to (use '0.0.0.0' to expose to the netw
                       ork)                      [string] [default: "127.0.0.1"]
      --secure         Use secure (https/wss) connection
                                                      [boolean] [default: false]
      --store          Store chat messages in chats.json
                                                      [boolean] [default: false]
      --giphy-api-key  Giphy API key (https://developers.giphy.com/docs/api/)
                                                          [string] [default: ""]
  -h, --help           Show help                                       [boolean]
```

And environment variables via `export` command or `.env` file:

```sh
GIPHY_API_KEY=e2aBcDeFgHiJkLmNoPqRsT1234567890
STORE_CHAT=true
```

## Contributing

Yes, thank you! This plugin is community-driven, most of its features are from different authors.
Please update the docs and tests and add your name to the `package.json` file.

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://jeanlescure.cr"><img src="https://shortunique.id/assets/contributors/jeanlescure.svg" /></a><table><tbody><tr><td width="150" align="center"><a href="#maintenance-jeanlescure" title="Maintenance">🚧</a> <a href="https://github.com/simplyhexagonal/fastify-chat-server/commits?author=jeanlescure" title="Code">💻</a> <a href="https://github.com/simplyhexagonal/fastify-chat-server/commits?author=jeanlescure" title="Documentation">📖</a> <a href="https://github.com/simplyhexagonal/fastify-chat-server/commits?author=jeanlescure" title="Tests">⚠️</a></td></tr></tbody></table></td>
    <td align="center"><a href="https://dianalu.design"><img src="https://shortunique.id/assets/contributors/dilescure.svg" /></a><table><tbody><tr><td width="150" align="center"><a href="https://github.com/simplyhexagonal/fastify-chat-server/commits?author=DiLescure" title="User Testing">📓</a></td></tr></tbody></table></td>
  </tr>
</table>
<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

## License

Copyright (c) 2023-Present [Fastify Chat Server Contributors](https://github.com/simplyhexagonal/fastify-chat-server/#contributors-).<br/>
Licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).

For your convenience, here is a list of all the licenses of this package's dependencies:

- Apache-2.0
- MIT
- ISC
- BSD-3-Clause
- BSD-2-Clause
