Auth Template für nextjs

TODO:
Sessions mit IP-Adresse und User-Agent speichern
Profile Page mit ändern von Daten zb. Profilbild
2FA
Single Prisma Client/Adapter

api wrapper for api security:
api routes usage:
// PUT-Methode: Aktualisiert ein Fach
const putSubjectHandler = async (req: Request, session: any, params: { id: string }) => {
    //api logic
}

export const PUT = protectedRoute(putSubjectHandler);