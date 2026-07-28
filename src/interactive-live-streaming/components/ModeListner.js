import {
  Constants,
  useMeeting,
  useParticipant,
  usePubSub,
} from "@videosdk.live/react-sdk";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import ConfirmBox from "../../components/ConfirmBox";
import { useMeetingAppContext } from "../../MeetingAppContextDef";

const reqInfoDefaultState = {
  enabled: false,
  mode: null,
  senderId: null,
  accept: () => {},
  reject: () => {},
};

const ModeListner = ({ setMeetingMode, meetingMode }) => {
  const mMeetingRef = useRef();
  const { setSideBarMode } = useMeetingAppContext();

  const [reqModeInfo, setReqModeInfo] = useState(reqInfoDefaultState);

  const mMeeting = useMeeting();
  const localParticipantId = mMeeting?.localParticipant?.id;
  const participant = useParticipant(localParticipantId);

  const participantRef = useRef();

  useEffect(() => {
    mMeetingRef.current = mMeeting;
  }, [mMeeting]);

  useEffect(() => {
    participantRef.current = participant;
  }, [participant]);

  usePubSub(`CHANGE_MODE_${mMeeting?.localParticipant?.id}`, {
    onMessageReceived: async (data) => {
      const message = JSON.parse(data.message);
      if (message.mode === Constants.modes.SEND_AND_RECV) {
        const muteMic = mMeetingRef.current?.muteMic;
        const disableWebcam = mMeetingRef.current?.disableWebcam;
        const disableScreenShare = mMeetingRef.current?.disableScreenShare;

        try {
          await muteMic();
          await disableWebcam();
          await disableScreenShare();
        } catch (err) {
          console.error('muteMic/disableWebcam/disableScreenShare failed', err);
        }
        setReqModeInfo({
          enabled: true,
          senderId: data.senderId,
          mode: message.mode,
          accept: () => {},
          reject: () => {},
        });
      } else {
        try {
          await mMeeting.changeMode(message.mode);
        } catch (err) {
          console.error('changeMode failed', err);
        }

        const muteMic = mMeetingRef.current?.muteMic;
        const disableWebcam = mMeetingRef.current?.disableWebcam;
        const disableScreenShare = mMeetingRef.current?.disableScreenShare;

        try {
          await muteMic();
          await disableWebcam();
          await disableScreenShare();
        } catch (err) {
          console.error('muteMic/disableWebcam/disableScreenShare failed', err);
        }

        setSideBarMode(null);
      }
    },
  });

  const { publish: invitatioAcceptedPublish } = usePubSub(
    `INVITATION_ACCEPT_BY_COHOST`,
    {
      onMessageReceived: (data) => {
        new Audio(
          `https://static.videosdk.live/prebuilt/notification.mp3`
        ).play();

        toast(`${data.senderName} has been added as a Co-host`, {
          position: "bottom-left",
          autoClose: 4000,
          hideProgressBar: true,
          closeButton: false,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "light",
        });
      },
      onOldMessagesReceived: (messages) => {},
    }
  );

  const { publish: invitatioRejectedPublish } = usePubSub(
    `INVITATION_REJECT_BY_COHOST`,
    {
      onMessageReceived: (data) => {
        if (data.message.senderId === participantRef.current.participant.id) {
          new Audio(
            `https://static.videosdk.live/prebuilt/notification.mp3`
          ).play();

          toast(
            `${data.senderName} has rejected the request to become Co-host`,
            {
              position: "bottom-left",
              autoClose: 4000,
              hideProgressBar: true,
              closeButton: false,
              pauseOnHover: true,
              draggable: true,
              progress: undefined,
              theme: "light",
            }
          );
        }
      },
    }
  );

  useMeeting({
    onParticipantModeChanged: ({ mode, participantId }) => {
      if (participantId === localParticipantId) {
        setMeetingMode(mode);
      }
    },
  });

  return (
    <>
      <ConfirmBox
        open={reqModeInfo.enabled}
        successText={"Accept"}
        rejectText={"Deny"}
        onReject={async () => {
          setReqModeInfo(reqInfoDefaultState);
          try {
            await invitatioRejectedPublish(
              { senderId: reqModeInfo.senderId },
              { persist: true }
            );
          } catch (err) {
            console.error('invitatioRejectedPublish failed', err);
          }
        }}
        onSuccess={async () => {
          try {
            await mMeeting.changeMode(reqModeInfo.mode);
          } catch (err) {
            console.error('changeMode failed', err);
          }
          setReqModeInfo(reqInfoDefaultState);
          try {
            await invitatioAcceptedPublish({}, { persist: true });
          } catch (err) {
            console.error('invitatioAcceptedPublish failed', err);
          }
        }}
        title={`Request to become a Co-host`}
        subTitle={`Host has requested you to become a Co-host`}
      />
    </>
  );
};

export default ModeListner;
