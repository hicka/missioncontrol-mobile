// iOS 27 launches an app built with its SDK only if the app adopts the scene
// lifecycle; Expo SDK 52's native template predates that, so such a build
// quits at launch. React Native still builds its view controller while the
// app finishes launching, so the one scene takes it into a window of its own,
// and links that arrive at the scene go on to React Native's Linking as
// before. Scenes exist since iOS 13, so older systems behave the same.
const fs = require("fs");
const path = require("path");
const { withDangerousMod, withInfoPlist } = require("expo/config-plugins");

const MARK = "@implementation SceneDelegate";
const SCENE = `
// The scene lifecycle (plugins/withSceneLifecycle.js): the one scene takes
// React Native's view controller into a window of its own.
@interface SceneDelegate : UIResponder <UIWindowSceneDelegate>
@property (nonatomic, strong) UIWindow *window;
@end

${MARK}

- (void)scene:(UIScene *)scene willConnectToSession:(UISceneSession *)session options:(UISceneConnectionOptions *)connectionOptions
{
  id<UIApplicationDelegate> app = UIApplication.sharedApplication.delegate;
  UIWindow *launchWindow = app.window;
  if (![scene isKindOfClass:[UIWindowScene class]] || launchWindow == nil) {
    return;
  }
  // a window that belongs to the scene from the start, holding React Native's view controller
  UIWindow *window = [[UIWindow alloc] initWithWindowScene:(UIWindowScene *)scene];
  UIViewController *root = launchWindow.rootViewController;
  launchWindow.rootViewController = nil;
  launchWindow.hidden = YES;
  window.rootViewController = root;
  app.window = window;
  self.window = window;
  [window makeKeyAndVisible];
  [self openURLContexts:connectionOptions.URLContexts];
}

- (void)scene:(UIScene *)scene openURLContexts:(NSSet<UIOpenURLContext *> *)URLContexts
{
  [self openURLContexts:URLContexts];
}

- (void)openURLContexts:(NSSet<UIOpenURLContext *> *)contexts
{
  for (UIOpenURLContext *context in contexts) {
    [RCTLinkingManager application:UIApplication.sharedApplication openURL:context.URL options:@{}];
  }
}

@end
`;

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          { UISceneConfigurationName: "Default", UISceneDelegateClassName: "SceneDelegate" },
        ],
      },
    };
    return cfg;
  });
}

function withSceneDelegate(config) {
  return withDangerousMod(config, ["ios", async (cfg) => {
    const file = path.join(cfg.modRequest.platformProjectRoot, cfg.modRequest.projectName, "AppDelegate.mm");
    if (!fs.existsSync(file)) return cfg;
    const text = fs.readFileSync(file, "utf8");
    if (!text.includes(MARK)) fs.writeFileSync(file, text + SCENE);
    return cfg;
  }]);
}

module.exports = (config) => withSceneDelegate(withSceneManifest(config));
