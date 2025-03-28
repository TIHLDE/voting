import { ArrowForwardIcon, CloseIcon } from '@chakra-ui/icons';
import { Button, FormControl, FormLabel, Switch, Text } from '@chakra-ui/react';
import React, { useContext, useState } from 'react';
import { Role, VotationStatus, useUpdateVotationStatusMutation } from '../../__generated__/graphql-types';
import { ActiveVotationContext } from '../../pages/ActiveVotation';
import { MeetingContext } from '../../pages/MeetingLobby';
import CustomAlertDialog, { DialogType } from '../common/CustomAlertDialog';
import WrapStack from '../common/layout/WrapStack';
import { green } from '../styles/colors';

interface VotationControllerProps {
  status: VotationStatus;
  showVote: boolean;
  toggleShowVote: () => void;
  disableShowVote: boolean;
  backToVotationList: () => void;
}

const ActiveVotationController: React.FC<VotationControllerProps> = ({
  status,
  showVote,
  toggleShowVote,
  disableShowVote,
  backToVotationList,
}) => {
  const [updateVotationStatus] = useUpdateVotationStatusMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [invalidateVotationDialogOpen, setInvalidateVotationDialogOpen] = useState(false);
  const { votationId } = useContext(ActiveVotationContext);
  const { role, presentationMode } = useContext(MeetingContext);

  const getText = () => {
    switch (status) {
      case VotationStatus.Open:
        return 'Gå videre';
      case VotationStatus.CheckingResult:
        return 'Publiser resultater';
    }
  };

  const getNextStatus = () => {
    switch (status) {
      case VotationStatus.Open:
        return VotationStatus.CheckingResult;
      case VotationStatus.CheckingResult:
        return VotationStatus.PublishedResult;
      default:
        return VotationStatus.CheckingResult;
    }
  };

  const getDialogType = () => {
    switch (status) {
      case VotationStatus.Open:
        return DialogType.CLOSE;
      case VotationStatus.CheckingResult:
        return DialogType.PUBLISH;
      default:
        return DialogType.PUBLISH;
    }
  };

  const handleConfirm = () => {
    updateVotationStatus({
      variables: { votationId, status: getNextStatus() },
    });
    setDialogOpen(false);
  };

  const handleInvalidResult = async () => {
    await updateVotationStatus({ variables: { votationId, status: VotationStatus.Invalid } });
    backToVotationList();
  };

  return (
    <WrapStack breakpoint={650} w="100%" justifyContent="space-between" spacing="2">
      {role === Role.Admin ? (
        <Button
          variant="standard"
          p="1.5em 4em"
          borderRadius="16em"
          onClick={() => setInvalidateVotationDialogOpen(true)}
          leftIcon={<CloseIcon h="2.5" />}
        >
          <Text>Avbryt votering</Text>
        </Button>
      ):null}
      {status === VotationStatus.Open && !presentationMode && (
        <FormControl display="flex" width="fit-content">
          <FormLabel ml="0.5em" fontWeight="bold" htmlFor="hide-vote" mb="0" py="0.5rem">
            Vis meg hva jeg stemte
          </FormLabel>
          <Switch
            isDisabled={disableShowVote}
            id="hide-vote"
            mt="1px"
            py="0.5rem"
            onChange={toggleShowVote}
            isChecked={showVote}
          />
        </FormControl>
      )}
      {role === Role.Admin && (
        <Button variant="standard" w="fit-content" onClick={() => setDialogOpen(true)} rightIcon={<ArrowForwardIcon />}>
          <Text justifyContent="end">{getText()}</Text>
        </Button>
      )}
      <CustomAlertDialog
        dialogIsOpen={invalidateVotationDialogOpen}
        handleCancel={() => setInvalidateVotationDialogOpen(false)}
        handleConfirm={handleInvalidResult}
        type={DialogType.INVALIDATE}
        confirmColor="red.500"
      />
      <CustomAlertDialog
        dialogIsOpen={dialogOpen}
        handleCancel={() => setDialogOpen(false)}
        handleConfirm={handleConfirm}
        type={getDialogType()}
        confirmColor={green()}
      />
    </WrapStack>
  );
};

export default ActiveVotationController;
