// Order matters: the Switch takes the first match. Home and Main first, NotFound last.
export { Home } from './local/Home';
export { Main } from './local/Main';
export { AdminConsoleRoute } from './local/AdminConsole';
export { UserGuideRoute } from './local/UserGuideRoute';
export { MyProfileRoute } from './local/MyProfile';
// KEEP ON THE BOTTOM
export { NotFoundRoute } from './local/404'
