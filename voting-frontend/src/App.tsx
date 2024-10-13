import { withAuthenticationRequired } from '@auth0/auth0-react';
import { Center, Spinner } from '@chakra-ui/react';
import { FC } from 'react';
import { Route, Routes } from 'react-router-dom';
import Navbar from './components/common/Navbar';
import AboutUs from './pages/AboutUs';
import FrontPage from './pages/FrontPage';
import ManageMeeting from './pages/ManageMeeting';
import MeetingLobby from './pages/MeetingLobby';
import MyMeetings from './pages/MyMeetings';
import MyProfile from './pages/MyProfile';
import RegisterForMeeting from './pages/RegisterForMeeting';

const App: FC = () => {
  return (
    <>
      <Navbar />
      <Routes>
        <Route key="edit-meeting" path="/meeting/:meetingId/edit" element={<ManageMeeting />} />
        <Route key="add-meeting" path="/meeting/new" element={<ManageMeeting />} />
        <Route path="/meeting/:meetingId/register" element={withAuthenticationRequired(RegisterForMeeting, {
          onRedirecting: () => {
            return <Center height="100vh">
              <Spinner thickness="4px" speed="0.65s" emptyColor="gray.200" color="gray.500" size="xl" />
            </Center>
          }
        })} />
        <Route path="/meeting/:meetingId" element={<MeetingLobby />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/myProfile" element={<MyProfile />} />
        <Route path="/myMeetings" element={<MyMeetings />} />
        <Route path="/" element={<FrontPage />} />
      </Routes>
    </>
  );
};

export default App;
