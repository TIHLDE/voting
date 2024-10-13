import { useAuth0 } from '@auth0/auth0-react';
import { Button, Center, useToast, VStack } from '@chakra-ui/react';
import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRegisterAsParticipantMutation } from '../__generated__/graphql-types';
import Loading from '../components/common/Loading';

const RegisterForMeeting: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [registerAsParticipant, { loading}] = useRegisterAsParticipantMutation({
    onCompleted: () => {
      toast({
        title: 'Du ble lagt til i møtet',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      navigate(`/meeting/${meetingId}`, { replace: true });
    },
    onError: () => {
      toast({
        title: 'Noe gikk galt',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    },
  });
  const { isAuthenticated, loginWithRedirect, isLoading } = useAuth0();

  const { meetingId } = useParams<{ meetingId: string }>();

  useEffect(() => {
    if (!isAuthenticated && !isLoading && !loading) {
      setTimeout(() => {
      loginWithRedirect({
        appState: {
          returnTo: window.location.href,
          },
        });
      }, 1000);
    } 
  }, [isAuthenticated, isLoading, loading, loginWithRedirect]);

  if (loading || isLoading) return <Loading text="Registrerer deg som deltaker" />;
  if(!meetingId) return <div>Noe gikk galt</div>;
  

  

  return (
    <Center mt="20vh" mb="2vh">
      <VStack>
        <Button onClick={() => registerAsParticipant({ variables: { meetingId } })}>Registrer deg som deltaker</Button>
      </VStack>
    </Center>
  );
};

export default RegisterForMeeting;
