import { Composer } from './deps.deno.ts';
import type { Context, NextFunction, SessionFlavor } from './deps.deno.ts';

type ContextScene = {
  enter: (scene: string, willSuppressEntry?: boolean) => void
  exit: (willSuppressExit?: boolean) => void
};

type SceneSessionData = {
  scene: string | undefined
};

type SceneContext<C extends Context = Context> = C & { scene: ContextScene } & SessionFlavor<SceneSessionData>;

type EntryExitFunction = <C extends SceneContext = SceneContext>(ctx: C) => void;

const scenes = new Set<string>();
const sceneEntries = new Map<string, EntryExitFunction>();
const sceneExits = new Map<string, EntryExitFunction>();

const createScene = <C extends SceneContext = SceneContext>(
  scene: string,
  onEntry?: EntryExitFunction,
  onExit?: EntryExitFunction,
) => {
  if (scenes.has(scene)) {
    throw new Error(`Scene ${scene} already exists. Refusing to register.`);
  }

  scenes.add(scene);
  if (onEntry !== undefined) {
    sceneEntries.set(scene, onEntry);
  }
  if (onExit !== undefined) {
    sceneExits.set(scene, onExit);
  }

  const sceneMiddleware = new Composer<C>();
  const sceneBuilder = sceneMiddleware.filter(ctx => ctx.session.scene === scene);
  return { sceneMiddleware, sceneBuilder };
};

const middleware = async <C extends SceneContext>(ctx: C, next: NextFunction) => {
  ctx.scene = {
    enter: async (scene: string, willSuppressEntry: boolean = false) => {
      if (!scenes.has(scene)) {
        throw new Error(`Scene ${scene} does not exists. Refusing to enter.`);
      }
      ctx.session.scene = scene;
      
      const entryFunction = sceneEntries.get(scene);
      if (willSuppressEntry || entryFunction === undefined) {
        return;
      }
      await entryFunction(ctx);
    },
    exit: async (willSuppressExit: boolean = false) => {
      const scene = ctx.session.scene;
      if (scene === undefined) {
        return;
      }
      ctx.session.scene = undefined;

      const exitFunction = sceneExits.get(scene);
      if (willSuppressExit || exitFunction === undefined) {
        return;
      }
      await exitFunction(ctx);
    }
  };
  return next();
};

export { createScene, middleware as hydrateScene };
export type { ContextScene, EntryExitFunction, SceneContext, SceneSessionData };
