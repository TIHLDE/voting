import { Auth0Provider } from '@auth0/auth0-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useRegisterAsParticipantMutation } from '../../__generated__/graphql-types';
const Auth0WithHistoryProvider: React.FC = ({ children }) => {
  const navigate = useNavigate();
  const domain = process.env.REACT_APP_AUTH0_DOMAIN ?? '';
  const clientId = process.env.REACT_APP_AUTH0_CLIENT_ID ?? '';
  const callbackUrl = process.env.REACT_APP_REDIRECT_URI;
  const audience = process.env.REACT_APP_AUTH0_AUDIENCE;
  const [registerAsParticipant] = useRegisterAsParticipantMutation();


  
  return (
    <Auth0Provider 
      domain={domain}
      clientId={clientId}
      redirectUri={callbackUrl}
      audience={audience}
      onRedirectCallback={(appState) => {
        navigate(appState?.returnTo || "/", { replace: true });
        if (appState?.returnTo?.startsWith("/meeting/") && appState?.returnTo?.endsWith("/register")) {
          registerAsParticipant({
            variables: {
              meetingId: appState.returnTo.split("/")[1],
            },
          });
        }
      }}
    >
      {children}
    </Auth0Provider>
  );
};

export default Auth0WithHistoryProvider;
