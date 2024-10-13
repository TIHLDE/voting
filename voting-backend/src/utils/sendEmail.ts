import { Meeting, Role } from '@prisma/client';
import moment from 'moment';
import nodemailer from 'nodemailer';
import { ParticipantOrInviteType } from '../schema/meeting';

const transporter = nodemailer.createTransport( {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
    secure: false,
});


moment.locale('nb');

const roleToText = new Map([
    [Role.ADMIN, 'administrator'],
    [Role.COUNTER, 'teller'],
    [Role.PARTICIPANT, 'deltaker'],
]);


const createEmail = (_email: string, role: Role, meeting: Meeting, userIsRegistered: boolean) => {

    const emailContents = `<p>Hei</p><p>Du er lagt til som ${roleToText.get(role)} på <b>${meeting.title}</b>. Møtet stater ${moment(
                meeting.startTime
            ).format('dddd DD.MM.YYYY')} kl. ${moment(meeting.startTime).format('HH:MM')}. ${
                !userIsRegistered
                    ? `Vennligst registrer deg på <a href="${process.env.FRONTEND_URL}">vedtatt.no</a> i forkant av møtet. Du vil finne møtet under "Mine møter".`
                    : `Møtet finner du under "Mine møter" på <a href="${process.env.FRONTEND_URL}">vedtatt.no</a>.`
            }`
        
    return emailContents;
};

const sendEmail = async (participants: ParticipantOrInviteType[], userIsRegistered: boolean, meeting: Meeting) => {
    try {
        

        const promises: Promise<string>[] = [];

        participants.forEach((participant) => {
            const emailContents = createEmail(participant.email, participant.role, meeting, userIsRegistered);
            promises.push(
                new Promise(async (resolve, reject) => {
                    const response = await transporter.sendMail({
                        from: process.env.EMAIL_USER,
                        to: participant.email,
                        subject: 'Du er invitert til et nytt møte.',
                        html: emailContents,
                    });
                    if (!response.accepted) reject('Could not send email.');
                    resolve(participant.email);
                })
            );
        });

        const resolved = await Promise.all(promises);
        return resolved;
    } catch (error) {
        console.log(error);
    }
};

export default sendEmail;
