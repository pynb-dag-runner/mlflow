FROM ubuntu:20.04

ARG HOST_GID
ARG HOST_UID

ENV DEBIAN_FRONTEND "noninteractive"

RUN apt-get -qq -y update && \
    apt-get -qq -y upgrade && \
    apt-get install -qq -y --no-install-recommends \
        python3 \
        python3-pip \
        make

RUN groupadd --gid $HOST_GID host_user_group  && \
    useradd --uid $HOST_UID --gid $HOST_GID -rm --shell /bin/bash host_user

USER host_user
ENV PATH "/home/host_user/.local/bin:$PATH"

ENTRYPOINT ["/bin/bash", "-c"]
