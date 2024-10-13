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


  if (!isAuthenticated) {
    loginWithRedirect({
      appState: {
              returnTo: window.location.href,
            },
            authorizationParams: {
              redirect_uri: process.env.REACT_APP_REDIRECT_URI,
            },
      });
  } 

  if (loading) return <Loading text="Registrerer deg som deltaker" />;
  if (meetingId) {
    registerAsParticipant({ variables: { meetingId } });
  }
  if (data) {
    return (
      <Center mt="10vh" mb="1vh">
        <VStack>
          <Text as="b">Registrering vellykket.</Text>
          <Text>Du vil bli videresendt til møtet om litt.</Text>
        </VStack>
      </Center>
    );
  }

  

    
  return (
    <Center mt="10vh" mb="1vh">
      <VStack>
        <Text as="b">Kunne ikke registrere deg som deltaker.</Text>
        <Text>Enten finnes ikke møtet, eller så tillater det ikke selvregistrering.</Text>
      </VStack>
    </Center>
  );
};

export default RegisterForMeeting;
