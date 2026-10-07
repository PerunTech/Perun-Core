import { routeGuard } from '../routeGuard';
import { svSessionRegxp } from '../../model';
import { Loading } from '../../components/ComponentsIndex';
import LandingContainer from '../../containers/Landing'

const UserIsAuthenticatedSoNeverEnter = routeGuard({
    redirectPath: () => '/main',
    authenticatedSelector: state => !svSessionRegxp(state.security.svSession),
    authenticatingSelector: state => state.security.isBusy,
    wrapperDisplayName: 'UserIsAuthenticatedSoNeverEnter',
    AuthenticatingComponent: Loading
})
const Landing = UserIsAuthenticatedSoNeverEnter(LandingContainer);

{/* Landing with subroutes */ }
export const Home = {
    path: '/home',
    render: Landing,
    isExact: false
};