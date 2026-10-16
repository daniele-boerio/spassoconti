"""`GET /api/health` è il healthcheck del container: deve dire la verità sul
database, perché un BE che risponde ma non raggiunge Postgres va in 500 su ogni
chiamata vera e deve risultare unhealthy (e far tornare indietro il deploy).
"""

from database import get_db
from main import app


def test_health_ok_con_database_raggiungibile(api):
    risposta = api.get("/health")

    assert risposta.status_code == 200
    assert risposta.json() == {"status": "ok", "database": "ok"}


def test_health_503_se_il_database_non_risponde(api):
    class SessioneRotta:
        def execute(self, *args, **kwargs):
            raise ConnectionRefusedError("connection refused")

    def db_irraggiungibile():
        yield SessioneRotta()

    app.dependency_overrides[get_db] = db_irraggiungibile

    risposta = api.get("/health")

    assert risposta.status_code == 503
    assert risposta.json()["database"] == "unreachable"


def test_le_rotte_stanno_sotto_api(api):
    # Fuori da /api c'è il frontend (nginx): il BE non deve rispondere lì.
    assert api.get("http://testserver/conti").status_code == 404
    assert api.get("/conti").status_code == 401
