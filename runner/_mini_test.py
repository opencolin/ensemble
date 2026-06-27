"""Validate the mini-SWE-agent + ConTree + Token Factory integration on one task."""
import os, sys, yaml
sys.path.insert(0, os.path.dirname(__file__))
import run as runner
from minisweagent.environments.extra.contree import ContreeEnvironment
from minisweagent.agents.default import DefaultAgent
from minisweagent.models import get_model
from contree_sdk.config import ContreeConfig
from contree_sdk.auth import IAMAuth

# Pull public images anonymously (ContreeEnvironment hard-codes images.oci w/ creds).
class TFEnv(ContreeEnvironment):
    def _pull_image(self):
        return self.client.images.use(self.config.image)

CFG = yaml.safe_load(open(os.path.join(os.path.dirname(runner.__file__), "..", ".venv/lib/python3.11/site-packages/minisweagent/config/default.yaml")))
SYS, INST = CFG["agent"]["system_template"], CFG["agent"]["instance_template"]

# litellm -> Token Factory inference (OpenAI-compatible)
os.environ["OPENAI_API_KEY"] = os.environ["NEBIUS_API_KEY"]
os.environ["OPENAI_API_BASE"] = "https://api.tokenfactory.nebius.com/v1"
os.environ["MSWEA_COST_TRACKING"] = "ignore_errors"  # TF models aren't in litellm's pricing DB

LANG = {"python": ("python:3.13-slim", "pip install -q pytest", {"HOME": "/root"})}
task = next(t for t in runner.discover_tasks() if t.id == "py-expr-eval")
image, setup, lenv = LANG[task.language]

tf = ContreeConfig(auth=IAMAuth(base_url="https://api.tokenfactory.nebius.com/sandboxes/",
                                token=os.environ["NEBIUS_API_KEY"], project_id=os.environ["NEBIUS_AI_PROJECT"]))
env = TFEnv(contree_config=tf, image=image, image_tag="latest", cwd="/work",
            import_username="", import_password="", env={**CFG["environment"]["env"], **lenv})
print("env up; seeding stub…", flush=True)
stub = {f"/work/{p.name}": str(p) for p in task.workspace.iterdir() if p.name not in task.hidden_tests}
env.session.run(shell=setup, files=stub, cwd="/work", env=lenv, disposable=False).wait()
print("seed exit:", env.session.exit_code, flush=True)

model = get_model("openai/zai-org/GLM-5.2", config={"model_kwargs": {"drop_params": True, "max_tokens": 28000}})
agent = DefaultAgent(model, env, system_template=SYS, instance_template=INST,
                     step_limit=40, cost_limit=1.0, output_path="/tmp/mini_out.json")
print("running agent…", flush=True)
result = agent.run(task.prompt)
print("agent exit_status:", result.get("exit_status"), "| calls:", agent.n_calls, flush=True)

hidden = {f"/work/{n}": str(task.workspace / n) for n in task.hidden_tests}
env.session.run(shell=task.acceptance, files=hidden, cwd="/work", env=lenv, disposable=False).wait()
score = runner.score_from_output(task.acceptance, env.session.stdout, env.session.stderr, env.session.exit_code)
print(f"\n>>> GRADE: {score*100:.1f}%  (exit {env.session.exit_code})", flush=True)
