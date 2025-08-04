api wrapper for api security:
api routes usage:
// PUT-Methode: Aktualisiert ein Fach
const putSubjectHandler = async (req: Request, session: any, params: { id: string }) => {
    //api logic
}

export const PUT = protectedRoute(putSubjectHandler);