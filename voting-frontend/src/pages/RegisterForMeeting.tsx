import { useAuth0 } from '@auth0/auth0-react';
import { Center, Text, useToast, VStack } from '@chakra-ui/react';
import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRegisterAsParticipantMutation } from '../__generated__/graphql-types';
import Loading from '../components/common/Loading';

const RegisterForMeeting: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [registerAsParticipant, { data, loading, error }] = useRegisterAsParticipantMutation();
  const { isAuthenticated, loginWithRedirect } = useAuth0();

  const { meetingId } = useParams<{ meetingId: string }>();

  

  console.log(meetingId, data, loading, error);
  useEffect(() => {
    if (meetingId && !loading && !data && !error) {
      registerAsParticipant({ variables: { meetingId } });
    }
  }, [meetingId, data, loading, error, registerAsParticipant]);

  useEffect(() => {
    if (data) {
      toast({
        title: 'Du ble lagt til i møtet',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      navigate(`/meeting/${meetingId}`, { replace: true });
    }
  }, [data, navigate, meetingId, toast]);

  if (!meetingId) return <></>;
  try {
    registerAsParticipant({ variables: { meetingId: meetingId } });
  } catch (e) {
    console.error(e);
  }

  if (loading) return <Loading text="Registrerer deg som deltaker" />;

  if (error)
    if (!isAuthenticated){
      setTimeout(
        () =>
          loginWithRedirect({
            appState: {
              returnTo: window.location.href,
            },
            authorizationParams: {
              redirect_uri: process.env.REACT_APP_REDIRECT_URI,
            },
          }),
        500
      );
    } else {
      return (
        <Center mt="10vh" mb="1vh">
          <VStack>
            <Text as="b">Kunne ikke registrere deg som deltaker.</Text>
            <Text>Enten finnes ikke møtet, eller så tillater det ikke selvregistrering.</Text>
          </VStack>
        </Center>
      );
    }
  return <></>;
};

export default RegisterForMeeting;
