import sqlite3
import pandas as pd

conn = sqlite3.connect('c:\\Users\\adars\\SIH\\myproject\\backend\\cloud.db')
df = pd.read_sql_query("SELECT metric_name, value FROM sensor_readings WHERE station_id='bharati' ORDER BY timestamp_utc DESC LIMIT 10", conn)
print(df)
