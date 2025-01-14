from pydantic import BaseModel
from typing import List, Optional
from app.model_player import Player

# Modèle pour une partie de Puissance 4
class Game(BaseModel):
    id: int
    players: List[Player]
    current_turn: int  # ID du joueur dont c'est le tour
    board: List[List[int]]  # Représentation du plateau (6 lignes, 7 colonnes)
    status: Optional[str] = "active"  # Statut de la partie (active, won, draw)
