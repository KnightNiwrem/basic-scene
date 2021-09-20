# Basic Scene plugin for grammY

This plugin provides a middleware for hydrating `Context` with a basic implementation of `scene`, and a function for creating scenes.

## Usage

```ts
import { Bot, session, SessionFlavor } from 'grammy';
import { createScene, hydrateScene, SceneContext } from 'basic-scene';

type SessionData = {
  motto: string | undefined
};

type AppContext = SceneContext & SessionFlavor<SessionData>;

// Create a scene for registering the user's motto
const {
  sceneMiddleware: mottoMiddleware,
  sceneBuilder: mottoBuilder,
} = createScene<AppContext>('register motto', async ctx => ctx.reply('Please provide your motto!'));
mottoBuilder.on(':text', async ctx => {
  ctx.session.motto = ctx.msg.text;
  await ctx.scene.exit();
  await ctx.reply(`Your motto is ${ctx.session.motto}!`);
});
mottoBuilder.use(async ctx => ctx.reply('Please provide a valid text motto!'));

const bot = new Bot<AppContext>('');

// Install session first!
bot.use(session({
  initial(): SessionData {
    return { motto: undefined };
  }
}));

// Install scene to ctx
bot.use(hydrateScene);

// Install the motto scene
bot.use(mottoMiddleware);

// Gets the user's motto, or make them register one if they don't have one
bot.command('motto', async ctx => {
  if (ctx.session.motto === undefined) {
    await ctx.scene.enter('register motto');
    return;
  }

  await ctx.reply(`Your motto is ${ctx.session.motto}!`);
});

bot.start();

```

## Complex Usage (working with external Context types)

```ts
import { Bot, Composer, Context, NextFunction, session, SessionFlavor } from 'grammy';
import { hydrateReply, ParseModeContext } from '@grammyjs/parse-mode';
import { createScene, EntryExitFunction, hydrateScene, SceneContext } from 'basic-scene';

type SessionData = {
  name: string | undefined
  age: number | undefined
};

type AppContext = ParseModeContext & SceneContext & SessionFlavor<SessionData>;

enum Scenes {
  RegisterAge = 'register age',
  RegisterName = 'register name',
};

const {
  sceneMiddleware: nameMiddleware,
  sceneBuilder: nameBuilder,
} = createScene<AppContext>(
  Scenes.RegisterName,
  async ctx => {
    await ctx.reply('Please provide your name!');
  },
);
nameBuilder.on(':text', async ctx => {
  const name = ctx.msg.text;
  if (name.length < 3 || name.length > 18) {
    ctx.replyWithHTML('Please ensure that your name is <b>between 4 and 17 characters long</b>!');
    return;
  }
  
  ctx.session.name = name;
  await ctx.scene.enter(Scenes.RegisterAge);
});
nameBuilder.use(async ctx => ctx.replyWithHTML('Please provide a <i>valid</i> name!'));

const {
  sceneMiddleware: ageMiddleware,
  sceneBuilder: ageBuilder,
} = createScene<AppContext>(
  Scenes.RegisterAge,
  async ctx => {
    await ctx.reply('Please provide your age!');
  },
);
ageBuilder.on(':text', async ctx => {
  const ageInput = ctx.msg.text;
  const age = Number(ageInput);
  if (Number.isNaN(age) || !Number.isInteger(age) || age < 8 || age > 120) {
    await ctx.replyWithHTML('Please provide a valid age <b>between 8 and 119 years old</b>!');
    return;
  }

  ctx.session.age = age;
  await ctx.scene.exit();
  await ctx.replyWithHTML(`Your name is <b>${ctx.session.name}</b> and your age is <b>${ctx.session.age}</b>!`);
});
ageBuilder.use(async ctx => ctx.replyWithHTML('Please provide a <i>valid</i> age!'));

const bot = new Bot<AppContext>('');
bot.use(session({
  initial(): SessionData {
    return { name: undefined, age: undefined };
  }
}));
bot.use(hydrateReply);
bot.use(hydrateScene);
bot.use(nameMiddleware);
bot.use(ageMiddleware);
bot.command('profile', async ctx => {
  const name = ctx.session.name;
  const age = ctx.session.age;
  if (name === undefined || age === undefined) {
    await ctx.scene.enter(Scenes.RegisterName);
    return;
  }

  await ctx.replyWithHTML(`Your name is <b>${ctx.session.name}</b> and your age is <b>${ctx.session.age}</b>!`);
});

bot.start();
```
