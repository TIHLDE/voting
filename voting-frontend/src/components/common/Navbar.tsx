import { useAuth0 } from '@auth0/auth0-react';
import { CloseIcon, HamburgerIcon } from '@chakra-ui/icons';
import { Box, Button, Divider, Flex, HStack, IconButton, Image, Stack, useDisclosure } from '@chakra-ui/react';
import React from 'react';
import { useNavigate } from 'react-router';
import { NavLink } from 'react-router-dom';
import Logo from '../../static/blue_logo.svg';
import { hamburgerIconColor, navBar, offwhite, pageBackground } from '../styles/colors';
import UserMenu from './UserMenu';

const Navbar: React.FC = () => {
  const { isAuthenticated } = useAuth0();
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Box bg={navBar} px="2rem" boxShadow="0px 4px 4px rgba(0, 0, 0, 0.05)" position="relative">
      <Flex as="nav" h="5.5rem" alignItems="center" justifyContent="space-between">
        <HomeButton />
        {!isAuthenticated ? (
          <LogInButton />
        ) : (
          <>
            <HStack as={'nav'} spacing="2em" display={{ base: 'none', md: 'flex' }}>
              <Links />
            </HStack>

            <UserMenu />

            <HamburgerTrigger isOpen={isOpen} onOpen={onOpen} onClose={onClose} />
          </>
        )}
      </Flex>
      {isOpen && <HamburgerBody onClose={onClose} />}
    </Box>
  );
};

const LogInButton = () => {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

  const logIn = () => {
    if (isLoading || isAuthenticated) return;
    setTimeout(
      () =>
        loginWithRedirect({
          appState: {
            returnTo: "/",
          },
        }),
      500
    );
  };

  return (
    <Button w="200px" size="md" colorScheme="orangeButton" color={offwhite} onClick={logIn}>
      Logg inn
    </Button>
  );
};

const HomeButton = () => {
  const navigate = useNavigate();

  return (
    <Box w="100px" justifyContent="start">
      <Image
        src={Logo}
        alt="Organisasjonskollegiet"
        h="3em"
        onClick={() => navigate('/', { replace: true })}
        _hover={{ cursor: 'pointer' }}
      />
    </Box>
  );
};

const Links = ({ onClose }: { onClose?: () => void }) => {
  const links: { text: string; link: string }[] = [
    { text: 'Mine møter', link: '/myMeetings' },
    { text: 'Opprett møte', link: '/meeting/new' },
    { text: 'Om oss', link: '/about' },
  ];

  return (
    <>
      {links.map((page) => (
        <NavLink to={page.link} key={page.text} style={({isActive}) =>{
          return {
            borderRadius: "1em",
            fontWeight: isActive ? 'bold' : 'semibold',
            backgroundColor : isActive ? pageBackground : navBar, 
            };
          }}
        >
          <Button w="100%" h="20%" borderRadius="1em" justifyContent="left" variant="link" onClick={onClose}>
            {page.text}
          </Button>
        </NavLink>
      ))}
    </>
  );
};

const HamburgerTrigger = ({
  isOpen,
  onOpen,
  onClose,
}: {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}) => {
  return (
    <IconButton
      bg={navBar}
      size={'md'}
      icon={isOpen ? <CloseIcon color={hamburgerIconColor} boxSize="1em" /> : <HamburgerIcon color={hamburgerIconColor} boxSize="1.5em" />}
      aria-label={'Open Menu'}
      display={{ md: 'none' }}
      onClick={isOpen ? onClose : onOpen}
    />
  );
};

const HamburgerBody = ({ onClose }: { onClose: () => void }) => {
  const { logout } = useAuth0();
  return (
    <Box pb={4} display={{ md: 'none' }}>
      <Divider mb="1rem" />
      <Stack as={'nav'} spacing={2} pl="0.5em">
        <Links onClose={onClose} />
        <NavLink style={{ fontWeight: 'bold' }} to={"/myProfile"} key={"Min profil"}>
          <Button w="100%" justifyContent="left" variant="link" onClick={onClose}>
            {"Min profil"}
          </Button>
        </NavLink>
        <Button maxW="max-content" variant="link" onClick={() => logout({ returnTo: window.location.origin })}>
          Logg ut
        </Button>
      </Stack>
    </Box>
  );
};

export default Navbar;
